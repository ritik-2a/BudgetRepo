import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MongoClient } from 'mongodb';

import { buildApp, ensureIndexes } from './app.js';

const { MONGODB_URI, MONGODB_DB = 'budget_tracker', JWT_SECRET, PORT = '4000' } = process.env;
if (!MONGODB_URI) throw new Error('MONGODB_URI is not set (see .env.example)');

const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(MONGODB_DB);
await ensureIndexes(db);

const updatesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'updates');
const app = buildApp({ db, jwtSecret: JWT_SECRET, updatesDir });
await app.listen({ port: Number(PORT), host: '0.0.0.0' });

const shutdown = async () => {
  await app.close();
  await client.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
