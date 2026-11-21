import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

/**
 * Wraps drizzle's useLiveQuery with an explicit `loading` flag, so screens can show
 * a skeleton/loader on first load and an ErrorState on failure, instead of a blank screen.
 */
export function useLiveData<T>(
  query: Parameters<typeof useLiveQuery>[0] & PromiseLike<T[]>,
  deps: unknown[] = [],
): { data: T[]; loading: boolean; error: Error | undefined } {
  const { data, error, updatedAt } = useLiveQuery(query, deps);
  return { data: data as T[], loading: !updatedAt && !error, error };
}
