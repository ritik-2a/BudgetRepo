import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categories, type Category, type CategoryKind } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { newId } from '@/lib/id';

export type CategoryInput = {
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  parentId?: string | null;
  quickAmount?: number | null;
};

/** Icons offered in the category editor (Ionicons names). */
export const CATEGORY_ICONS = [
  'restaurant',
  'fast-food',
  'cafe',
  'basket',
  'cart',
  'flash',
  'water',
  'wifi',
  'home',
  'bag-handle',
  'shirt',
  'film',
  'game-controller',
  'musical-notes',
  'repeat',
  'medkit',
  'fitness',
  'car',
  'car-sport',
  'train',
  'bus',
  'bicycle',
  'airplane',
  'speedometer',
  'school',
  'book',
  'gift',
  'heart',
  'paw',
  'construct',
  'phone-portrait',
  'tv',
  'briefcase',
  'cash',
  'trending-up',
  'pie-chart',
  'business',
  'people',
  'happy',
  'ellipsis-horizontal',
] as const;

export const CATEGORY_COLORS = [
  '#F28B66',
  '#6BBF59',
  '#F2B84B',
  '#8C7CF0',
  '#E76FA6',
  '#5DA9E9',
  '#9C89B8',
  '#4CC9A6',
  '#F0A43A',
  '#3FA7D6',
  '#E08E45',
  '#D9734E',
  '#2BB389',
  '#3D8BEB',
  '#C2417F',
  '#9AA0B5',
] as const;

export function useCategories(kind?: CategoryKind) {
  return useLiveData<Category>(
    db
      .select()
      .from(categories)
      .where(
        kind
          ? and(
              eq(categories.deleted, false),
              eq(categories.archived, false),
              eq(categories.kind, kind),
            )
          : and(eq(categories.deleted, false), eq(categories.archived, false)),
      )
      .orderBy(asc(categories.sortOrder)),
    [kind],
  );
}

export function getCategory(id: string): Category | undefined {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function createCategory(c: CategoryInput): string {
  const id = newId();
  const max = db
    .select({ m: sql<number>`coalesce(max(${categories.sortOrder}), -1)` })
    .from(categories)
    .get();
  db.insert(categories)
    .values({ id, ...c, name: c.name.trim(), sortOrder: (max?.m ?? -1) + 1 })
    .run();
  return id;
}

export function updateCategory(id: string, c: CategoryInput): void {
  db.update(categories)
    .set({ ...c, name: c.name.trim(), updatedAt: Date.now() })
    .where(eq(categories.id, id))
    .run();
}

/** Archive hides a category from pickers but keeps it on past transactions. */
export function archiveCategory(id: string): void {
  const now = Date.now();
  db.update(categories)
    .set({ archived: true, updatedAt: now })
    .where(sql`${categories.id} = ${id} or ${categories.parentId} = ${id}`)
    .run();
}

/** Parent categories with their children, in display order. */
export function groupCategories(list: Category[]): { parent: Category; children: Category[] }[] {
  const parents = list.filter((c) => !c.parentId);
  return parents.map((p) => ({ parent: p, children: list.filter((c) => c.parentId === p.id) }));
}
