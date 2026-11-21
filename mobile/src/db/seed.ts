import { eq } from 'drizzle-orm';

import { newId } from '@/lib/id';

import type { DB } from './client';
import { accounts, categories, settings, type CategoryKind } from './schema';

const SEED_KEY = 'seed_version';
const SEED_VERSION = '1';

type SeedCategory = {
  name: string;
  kind: CategoryKind;
  icon: string; // Ionicons name
  color: string;
  quickAmount?: number;
  children?: Omit<SeedCategory, 'kind' | 'children'>[];
};

const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Food & Dining', kind: 'expense', icon: 'restaurant', color: '#EB6834' },
  { name: 'Groceries', kind: 'expense', icon: 'basket', color: '#1BAF7A' },
  { name: 'Bills & Utilities', kind: 'expense', icon: 'flash', color: '#EDA100' },
  { name: 'Rent', kind: 'expense', icon: 'home', color: '#6250D6' },
  { name: 'Shopping', kind: 'expense', icon: 'bag-handle', color: '#E87BA4' },
  { name: 'Entertainment', kind: 'expense', icon: 'film', color: '#E34948' },
  { name: 'Subscriptions', kind: 'expense', icon: 'repeat', color: '#64748B' },
  { name: 'Health', kind: 'expense', icon: 'medkit', color: '#008300' },
  {
    name: 'Travel',
    kind: 'expense',
    icon: 'car',
    color: '#2A78D6',
    children: [
      { name: 'Auto', icon: 'car-sport', color: '#EB6834', quickAmount: 5000 },
      { name: 'Metro', icon: 'train', color: '#2A78D6', quickAmount: 4000 },
      { name: 'Cab', icon: 'car', color: '#6250D6' },
      { name: 'Fuel', icon: 'speedometer', color: '#EDA100' },
    ],
  },
  { name: 'Other', kind: 'expense', icon: 'ellipsis-horizontal', color: '#8A8F98' },
  { name: 'Salary', kind: 'income', icon: 'briefcase', color: '#1BAF7A' },
  { name: 'Other Income', kind: 'income', icon: 'cash', color: '#008300' },
  { name: 'Mutual Funds', kind: 'investment', icon: 'trending-up', color: '#2A78D6' },
];

const DEFAULT_ACCOUNTS = [
  { name: 'Bank (Salary)', type: 'bank', icon: 'business', color: '#0F766E' },
  { name: 'Cash', type: 'cash', icon: 'wallet', color: '#13805B' },
  { name: 'UPI', type: 'wallet', icon: 'phone-portrait', color: '#2A78D6' },
] as const;

/**
 * Inserts default categories and accounts the first time the app runs. Idempotent.
 * Note: the expo-sqlite driver's transactions are synchronous, so everything inside
 * uses `.run()` (no `await`) to keep it atomic.
 */
export function seedIfNeeded(db: DB): void {
  const done = db.select().from(settings).where(eq(settings.key, SEED_KEY)).all();
  if (done.length > 0) return;

  db.transaction((tx) => {
    let order = 0;
    for (const c of DEFAULT_CATEGORIES) {
      const parentId = newId();
      tx.insert(categories)
        .values({
          id: parentId,
          name: c.name,
          kind: c.kind,
          icon: c.icon,
          color: c.color,
          quickAmount: c.quickAmount,
          sortOrder: order++,
        })
        .run();
      for (const child of c.children ?? []) {
        tx.insert(categories)
          .values({
            id: newId(),
            name: child.name,
            kind: c.kind,
            icon: child.icon,
            color: child.color,
            parentId,
            quickAmount: child.quickAmount,
            sortOrder: order++,
          })
          .run();
      }
    }

    let accOrder = 0;
    for (const a of DEFAULT_ACCOUNTS) {
      tx.insert(accounts)
        .values({ id: newId(), ...a, sortOrder: accOrder++ })
        .run();
    }

    tx.insert(settings).values({ key: SEED_KEY, value: SEED_VERSION }).run();
  });
}

const PALETTE_KEY = 'palette_version';
const PALETTE_VERSION = '2';

/** Old default colour -> new palette (only untouched defaults are changed). */
const CATEGORY_RECOLOR: Record<string, [string, string]> = {
  'Food & Dining': ['#F28B66', '#EB6834'],
  Groceries: ['#6BBF59', '#1BAF7A'],
  'Bills & Utilities': ['#F2B84B', '#EDA100'],
  Rent: ['#8C7CF0', '#6250D6'],
  Shopping: ['#E76FA6', '#E87BA4'],
  Entertainment: ['#5DA9E9', '#E34948'],
  Subscriptions: ['#9C89B8', '#64748B'],
  Health: ['#4CC9A6', '#008300'],
  Travel: ['#F0A43A', '#2A78D6'],
  Auto: ['#F0A43A', '#EB6834'],
  Metro: ['#3FA7D6', '#2A78D6'],
  Cab: ['#E08E45', '#6250D6'],
  Fuel: ['#D9734E', '#EDA100'],
  Other: ['#9AA0B5', '#8A8F98'],
  Salary: ['#2BB389', '#1BAF7A'],
  'Other Income': ['#58C9A0', '#008300'],
  'Mutual Funds': ['#3D8BEB', '#2A78D6'],
};
const ACCOUNT_RECOLOR: Record<string, string> = {
  '#5B50E6': '#0F766E', // bank
  '#2BB389': '#13805B', // cash
  '#3D8BEB': '#2A78D6', // UPI / wallet
  '#C2417F': '#A8395F', // credit card
  '#3FA7D6': '#6250D6', // metro card
  '#F0A43A': '#B26A12', // money owed to me
};

/** One-time recolour of default categories/accounts to the new palette. Idempotent. */
export function upgradePalette(db: DB): void {
  const done = db.select().from(settings).where(eq(settings.key, PALETTE_KEY)).all();
  if (done.length > 0) return;
  const now = Date.now();
  db.transaction((tx) => {
    for (const c of tx.select().from(categories).all()) {
      const m = CATEGORY_RECOLOR[c.name];
      if (m && c.color.toUpperCase() === m[0]) {
        tx.update(categories)
          .set({ color: m[1], updatedAt: now })
          .where(eq(categories.id, c.id))
          .run();
      }
    }
    for (const a of tx.select().from(accounts).all()) {
      const next = a.color ? ACCOUNT_RECOLOR[a.color.toUpperCase()] : undefined;
      if (next) {
        tx.update(accounts).set({ color: next, updatedAt: now }).where(eq(accounts.id, a.id)).run();
      }
    }
    tx.insert(settings).values({ key: PALETTE_KEY, value: PALETTE_VERSION }).run();
  });
}
