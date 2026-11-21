/**
 * Integration test against the real MongoDB in MONGODB_URI, using a throwaway
 * database (dropped afterwards). Run: npm test
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { MongoClient } from 'mongodb';

import { buildApp, ensureIndexes } from '../src/app.js';

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const dbName = `budget_tracker_test_${Date.now()}`;
let app;

before(async () => {
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  app = buildApp({ db, jwtSecret: 'x'.repeat(40), logger: false });
});

after(async () => {
  await client.db(dbName).dropDatabase();
  await client.close();
});

const post = (url, body, token) =>
  app.inject({
    method: 'POST',
    url,
    payload: body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

test('register, login and auth errors', async () => {
  const r = await post('/auth/register', { email: 'A@Test.com', password: 'password123' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().email, 'a@test.com');

  assert.equal((await post('/auth/register', { email: 'a@test.com', password: 'password123' })).statusCode, 409);
  assert.equal((await post('/auth/register', { email: 'bad', password: 'password123' })).statusCode, 400);
  assert.equal((await post('/auth/register', { email: 'b@test.com', password: 'short' })).statusCode, 400);
  assert.equal((await post('/auth/login', { email: 'a@test.com', password: 'wrongpass1' })).statusCode, 401);
  assert.equal((await post('/auth/login', { email: 'a@test.com', password: 'password123' })).statusCode, 200);
  assert.equal((await post('/sync', { cursor: 0, changes: [] })).statusCode, 401);
  assert.equal((await post('/sync', { cursor: 0, changes: [] }, 'garbage')).statusCode, 401);
});

test('two devices sync with last-write-wins', async () => {
  const { token } = (await post('/auth/register', { email: 'sync@test.com', password: 'password123' })).json();
  const tx = (amount, updatedAt) => ({
    table: 'transactions',
    id: 'tx-1',
    updatedAt,
    data: { id: 'tx-1', amount, updatedAt, deleted: false },
  });

  // Device A pushes a transaction.
  const a1 = (await post('/sync', { cursor: 0, changes: [tx(5000, 1000)] }, token)).json();
  assert.equal(a1.applied, 1);
  assert.equal(a1.changes.length, 1);

  // Device B pulls it from scratch.
  const b1 = (await post('/sync', { cursor: 0, changes: [] }, token)).json();
  assert.equal(b1.changes[0].data.amount, 5000);

  // Stale edit (older updatedAt) is ignored.
  const stale = (await post('/sync', { cursor: b1.cursor, changes: [tx(1, 500)] }, token)).json();
  assert.equal(stale.applied, 0);

  // Newer edit from B wins; A sees it from its cursor.
  await post('/sync', { cursor: b1.cursor, changes: [tx(7000, 2000)] }, token);
  const a2 = (await post('/sync', { cursor: a1.cursor, changes: [] }, token)).json();
  assert.equal(a2.changes.length, 1);
  assert.equal(a2.changes[0].data.amount, 7000);

  // Soft delete propagates as a row with deleted=true.
  const del = { ...tx(7000, 3000), data: { id: 'tx-1', amount: 7000, updatedAt: 3000, deleted: true } };
  await post('/sync', { cursor: a2.cursor, changes: [del] }, token);
  const b2 = (await post('/sync', { cursor: b1.cursor, changes: [] }, token)).json();
  assert.equal(b2.changes.at(-1).data.deleted, true);

  // Nothing new → empty pull.
  const idle = (await post('/sync', { cursor: b2.cursor, changes: [] }, token)).json();
  assert.equal(idle.changes.length, 0);
});

test('users cannot see each other’s data and bad input is rejected', async () => {
  const t1 = (await post('/auth/register', { email: 'u1@test.com', password: 'password123' })).json().token;
  const t2 = (await post('/auth/register', { email: 'u2@test.com', password: 'password123' })).json().token;
  await post(
    '/sync',
    { cursor: 0, changes: [{ table: 'accounts', id: 'acc', updatedAt: 1, data: { name: 'Secret' } }] },
    t1,
  );
  const other = (await post('/sync', { cursor: 0, changes: [] }, t2)).json();
  assert.equal(other.changes.length, 0);

  const bad = await post('/sync', { cursor: 0, changes: [{ table: 'users', id: 'x', updatedAt: 1, data: {} }] }, t1);
  assert.equal(bad.statusCode, 400);
});

test('OTA manifest and assets are served from MongoDB', async () => {
  const { gzipSync, gunzipSync } = await import('node:zlib');
  const { otaStore } = await import('../src/ota.js');
  const db = client.db(dbName);
  const { updates, bucket } = otaStore(db);
  const key = 'a'.repeat(32);
  const body = Buffer.from('console.log("bundle")');
  await new Promise((resolve, reject) => {
    const up = bucket.openUploadStream(key, { metadata: { contentType: 'application/javascript' } });
    up.on('finish', resolve).on('error', reject);
    up.end(gzipSync(body));
  });
  const manifest = (id) => ({
    id,
    createdAt: '2026-11-22T00:00:00.000Z',
    runtimeVersion: '1.0.0',
    launchAsset: { hash: 'h', key, contentType: 'application/javascript', fileExtension: '.bundle', url: `/ota/assets/${key}` },
    assets: [],
    metadata: {},
    extra: {},
  });
  await updates.insertOne({ runtimeVersion: '1.0.0', platform: 'android', createdAt: new Date(1000), manifest: manifest('11111111-1111-4111-8111-111111111111') });
  await updates.insertOne({ runtimeVersion: '1.0.0', platform: 'android', createdAt: new Date(2000), manifest: manifest('22222222-2222-4222-8222-222222222222') });

  const ok = await app.inject({
    method: 'GET',
    url: '/updates/manifest',
    headers: { 'expo-platform': 'android', 'expo-runtime-version': '1.0.0', host: 'example.com', 'x-forwarded-proto': 'https' },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers['expo-protocol-version'], '1');
  assert.match(ok.headers['content-type'], /^multipart\/mixed; boundary=/);
  assert.match(ok.body, /name="manifest"/);
  assert.match(ok.body, /22222222-2222-4222-8222-222222222222/, 'serves the newest update');
  assert.match(ok.body, new RegExp(`https://example\.com/ota/assets/${key}`));

  const gz = await app.inject({ method: 'GET', url: `/ota/assets/${key}`, headers: { 'accept-encoding': 'gzip' } });
  assert.equal(gz.statusCode, 200);
  assert.equal(gz.headers['content-encoding'], 'gzip');
  assert.equal(gunzipSync(gz.rawPayload).toString(), body.toString());
  const plain = await app.inject({ method: 'GET', url: `/ota/assets/${key}` });
  assert.equal(plain.body, body.toString());

  assert.equal((await app.inject({ method: 'GET', url: `/ota/assets/${'b'.repeat(32)}` })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/ota/assets/not-a-key' })).statusCode, 400);
  const missing = await app.inject({
    method: 'GET',
    url: '/updates/manifest',
    headers: { 'expo-platform': 'android', 'expo-runtime-version': '9.9.9' },
  });
  assert.equal(missing.statusCode, 404);
  const bad = await app.inject({ method: 'GET', url: '/updates/manifest', headers: { 'expo-platform': 'web' } });
  assert.equal(bad.statusCode, 400);
});
