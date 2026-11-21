import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'budget.db';

// enableChangeListener powers drizzle's useLiveQuery (screens auto-refresh on writes).
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
expoDb.execSync('PRAGMA journal_mode = WAL;');

export const db = drizzle(expoDb, { schema });
export type DB = typeof db;
