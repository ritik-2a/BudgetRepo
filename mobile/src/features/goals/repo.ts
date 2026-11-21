import { asc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { goals, type Goal } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { newId } from '@/lib/id';

export type GoalInput = {
  name: string;
  targetAmount: number;
  targetDate?: string | null;
  savedAmount: number;
  icon?: string | null;
  color?: string | null;
};

export const GOAL_ICONS = [
  'flag',
  'shield-checkmark',
  'airplane',
  'car',
  'home',
  'school',
  'phone-portrait',
  'laptop',
  'gift',
  'heart',
  'diamond',
  'trophy',
] as const;

export function validateGoal(g: GoalInput): Partial<Record<keyof GoalInput, string>> {
  const e: Partial<Record<keyof GoalInput, string>> = {};
  if (!g.name.trim()) e.name = 'Enter a name';
  if (!(g.targetAmount > 0)) e.targetAmount = 'Target must be more than ₹0';
  if (g.savedAmount < 0) e.savedAmount = 'Cannot be negative';
  return e;
}

export function useGoals() {
  return useLiveData<Goal>(
    db.select().from(goals).where(eq(goals.deleted, false)).orderBy(asc(goals.createdAt)),
  );
}

export function getGoal(id: string): Goal | undefined {
  return db.select().from(goals).where(eq(goals.id, id)).get();
}

export function createGoal(g: GoalInput): string {
  const id = newId();
  db.insert(goals)
    .values({ id, ...g, name: g.name.trim() })
    .run();
  return id;
}

export function updateGoal(id: string, g: GoalInput): void {
  db.update(goals)
    .set({ ...g, name: g.name.trim(), updatedAt: Date.now() })
    .where(eq(goals.id, id))
    .run();
}

/** Adds (or with a negative amount, withdraws) money from a goal. */
export function contributeToGoal(id: string, amount: number): number {
  const g = getGoal(id);
  if (!g) throw new Error('Goal not found');
  const saved = Math.max(0, g.savedAmount + amount);
  db.update(goals).set({ savedAmount: saved, updatedAt: Date.now() }).where(eq(goals.id, id)).run();
  return saved;
}

export function deleteGoal(id: string): void {
  db.update(goals).set({ deleted: true, updatedAt: Date.now() }).where(eq(goals.id, id)).run();
}
