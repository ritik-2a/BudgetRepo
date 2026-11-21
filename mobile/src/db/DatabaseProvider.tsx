import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo, type ReactNode } from 'react';

import { FullScreenError, FullScreenLoader } from '@/components/feedback';

import migrations from '../../drizzle/migrations';
import { db } from './client';
import { seedIfNeeded } from './seed';

/** Runs pending migrations and first-run seeding before rendering the app. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const { success, error: migrationError } = useMigrations(db, migrations);

  // Seeding is synchronous and idempotent, so it runs once right after migrations succeed.
  const seedError = useMemo(() => {
    if (!success) return null;
    try {
      seedIfNeeded(db);
      return null;
    } catch (e: unknown) {
      return e instanceof Error ? e : new Error(String(e));
    }
  }, [success]);

  const error = migrationError ?? seedError;
  if (error) {
    return (
      <FullScreenError
        title="Couldn't open your data"
        message="The app couldn't prepare its on-device database. Close and reopen the app. Your existing data has not been deleted."
        error={error}
      />
    );
  }

  if (!success) {
    return (
      <FullScreenLoader
        message="Preparing your data…"
        hint="Setting up your accounts and categories. This only takes a moment."
      />
    );
  }

  return <>{children}</>;
}
