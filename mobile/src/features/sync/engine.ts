/**
 * Two-way sync with the Budget Tracker server (which stores data in MongoDB Atlas).
 *
 * - Push: every row whose `updatedAt` is newer than the last successful push.
 * - Pull: every row the server has changed since our cursor.
 * - Conflicts: last write wins on `updatedAt` (same rule on both sides).
 * - Deletes are soft (`deleted = true`) so they sync like any other edit.
 *
 * First sync on a fresh install: if the server already has data and this phone has no
 * transactions yet, the default seeded accounts/categories are replaced by the server's,
 * so a second phone doesn't end up with duplicate categories.
 */
import { eq, gt, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  accounts,
  budgets,
  categories,
  funds,
  goals,
  recurringRules,
  transactions,
} from '@/db/schema';

import { getPrefs, setPref } from '../settings/repo';
import { getToken, request, SyncError } from './api';

const TABLES = {
  accounts,
  categories,
  transactions,
  budgets,
  goals,
  funds,
  recurring_rules: recurringRules,
} as const;
type TableName = keyof typeof TABLES;
type AnyTable = (typeof TABLES)[TableName];

type Change = { table: TableName; id: string; updatedAt: number; data: Record<string, unknown> };
type SyncResponse = { cursor: number; more: boolean; applied: number; changes: Change[] };

const PUSH_BATCH = 1000;

export type SyncResult = { pushed: number; pulled: number; replacedDefaults: boolean };

let running: Promise<SyncResult> | null = null;

/** Runs a sync; concurrent calls share the same run. */
export function syncNow(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

function localChangesSince(since: number): Change[] {
  const out: Change[] = [];
  for (const [name, table] of Object.entries(TABLES) as [TableName, AnyTable][]) {
    const rows = db
      .select()
      .from(table as typeof accounts)
      .where(gt((table as typeof accounts).updatedAt, since))
      .all() as unknown as Record<string, unknown>[];
    for (const row of rows) {
      out.push({ table: name, id: String(row.id), updatedAt: Number(row.updatedAt), data: row });
    }
  }
  return out;
}

function applyRemote(changes: Change[]): number {
  let applied = 0;
  db.transaction(() => {
    for (const c of changes) {
      const table = TABLES[c.table] as typeof accounts | undefined;
      if (!table) continue;
      const local = db
        .select({ updatedAt: table.updatedAt })
        .from(table)
        .where(eq(table.id, c.id))
        .get();
      if (local && local.updatedAt >= c.updatedAt) continue;
      const data = { ...c.data, id: c.id } as typeof accounts.$inferInsert;
      db.insert(table).values(data).onConflictDoUpdate({ target: table.id, set: data }).run();
      applied++;
    }
  });
  return applied;
}

function localTransactionCount(): number {
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(transactions)
      .get()?.n ?? 0
  );
}

function wipeSyncedTables(): void {
  db.transaction((tx) => {
    for (const table of Object.values(TABLES)) tx.delete(table as typeof accounts).run();
  });
}

async function doSync(): Promise<SyncResult> {
  const token = await getToken();
  const prefs = getPrefs();
  if (!token || !prefs.syncServerUrl) throw new SyncError('Sign in to cloud sync first.');
  const url = prefs.syncServerUrl;
  const call = (cursor: number, changes: Change[]) =>
    request<SyncResponse>(url, '/sync', { body: { cursor, changes }, token, timeoutMs: 45_000 });

  let cursor = prefs.syncCursor;
  let pulled = 0;
  let replacedDefaults = false;

  // First sync: look at the server before pushing local defaults.
  if (cursor === 0 && prefs.syncLastAt === null) {
    const first = await call(0, []);
    if (first.changes.length > 0 && localTransactionCount() === 0) {
      wipeSyncedTables();
      replacedDefaults = true;
    }
    pulled += applyRemote(first.changes);
    cursor = first.cursor;
    let more = first.more;
    while (more) {
      const next = await call(cursor, []);
      pulled += applyRemote(next.changes);
      cursor = next.cursor;
      more = next.more;
    }
    setPref('syncCursor', cursor);
  }

  // Push local edits (in batches), pulling remote edits along the way.
  const pushStartedAt = Date.now();
  const outgoing = replacedDefaults ? [] : localChangesSince(prefs.syncLastPushAt);
  let pushed = 0;
  let i = 0;
  do {
    const batch = outgoing.slice(i, i + PUSH_BATCH);
    const res = await call(cursor, batch);
    pushed += batch.length;
    i += PUSH_BATCH;
    pulled += applyRemote(res.changes);
    cursor = res.cursor;
    let more = res.more;
    while (more) {
      const next = await call(cursor, []);
      pulled += applyRemote(next.changes);
      cursor = next.cursor;
      more = next.more;
    }
  } while (i < outgoing.length);

  setPref('syncCursor', cursor);
  setPref('syncLastPushAt', replacedDefaults ? Date.now() : pushStartedAt);
  setPref('syncLastAt', Date.now());
  return { pushed, pulled, replacedDefaults };
}

/** Clears local sync state (used on sign-out). Local data is kept. */
export function resetSyncState(): void {
  setPref('syncCursor', 0);
  setPref('syncLastPushAt', 0);
  setPref('syncLastAt', null);
  setPref('syncEmail', null);
}
