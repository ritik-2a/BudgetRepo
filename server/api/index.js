/**
 * Vercel serverless entry point. Every request is rewritten here (see vercel.json)
 * except static OTA files under /ota/, which Vercel serves from public/.
 *
 * The Mongo client and Fastify app are cached on the module so warm invocations
 * reuse the same connection pool.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MongoClient } from 'mongodb';

import { buildApp, ensureIndexes } from '../src/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));

let dbPromise;
function getDb() {
  if (!dbPromise) {
    const { MONGODB_URI, MONGODB_DB = 'budget_tracker' } = process.env;
    if (!MONGODB_URI) throw new Error('MONGODB_URI is not configured');
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 5,
    });
    dbPromise = client
      .connect()
      .then(async (c) => {
        const db = c.db(MONGODB_DB);
        await ensureIndexes(db);
        return db;
      })
      .catch((e) => {
        dbPromise = undefined; // retry on next request
        throw e;
      });
  }
  return dbPromise;
}

let appPromise;
function getApp() {
  if (!appPromise) {
    const app = buildApp({
      db: getDb,
      jwtSecret: process.env.JWT_SECRET,
      logger: { level: 'warn' },
      updatesDir: path.join(here, '..', 'updates'),
    });
    appPromise = app.ready().then(() => app);
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
