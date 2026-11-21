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
  { name: 'Food & Dining', kind: 'expense', icon: 'restaurant', color: '#F28B66' },
  { name: 'Groceries', kind: 'expense', icon: 'basket', color: '#6BBF59' },
  { name: 'Bills & Utilities', kind: 'expense', icon: 'flash', color: '#F2B84B' },
  { name: 'Rent', kind: 'expense', icon: 'home', color: '#8C7CF0' },
  { name: 'Shopping', kind: 'expense', icon: 'bag-handle', color: '#E76FA6' },
  { name: 'Entertainment', kind: 'expense', icon: 'film', color: '#5DA9E9' },
  { name: 'Subscriptions', kind: 'expense', icon: 'repeat', color: '#9C89B8' },
  { name: 'Health', kind: 'expense', icon: 'medkit', color: '#4CC9A6' },
  {
    name: 'Travel',
    kind: 'expense',
    icon: 'car',
    color: '#F0A43A',
    children: [
      { name: 'Auto', icon: 'car-sport', color: '#F0A43A', quickAmount: 5000 },
      { name: 'Metro', icon: 'train', color: '#3FA7D6', quickAmount: 4000 },
      { name: 'Cab', icon: 'car', color: '#E08E45' },
      { name: 'Fuel', icon: 'speedometer', color: '#D9734E' },
    ],
  },
  { name: 'Other', kind: 'expense', icon: 'ellipsis-horizontal', color: '#9AA0B5' },
  { name: 'Salary', kind: 'income', icon: 'briefcase', color: '#2BB389' },
  { name: 'Other Income', kind: 'income', icon: 'cash', color: '#58C9A0' },
  { name: 'Mutual Funds', kind: 'investment', icon: 'trending-up', color: '#3D8BEB' },
];

const DEFAULT_ACCOUNTS = [
  { name: 'Bank (Salary)', type: 'bank', icon: 'business', color: '#5B50E6' },
  { name: 'Cash', type: 'cash', icon: 'wallet', color: '#2BB389' },
  { name: 'UPI', type: 'wallet', icon: 'phone-portrait', color: '#3D8BEB' },
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
