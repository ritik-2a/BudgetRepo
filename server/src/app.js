/**
 * Budget Tracker sync API.
 *
 *   POST /auth/register  { email, password }          -> { token, email }
 *   POST /auth/login     { email, password }          -> { token, email }
 *   POST /sync           { cursor, changes: Change[] } -> { cursor, changes: Change[] }   (Bearer token)
 *   GET  /health
 *   GET  /updates/manifest   (Expo Updates protocol v1, used by expo-updates for OTA updates)
 *   GET  /ota/assets/:key    (update bundle/asset bytes, gzip)
 *
 * Change = { table, id, updatedAt, data }   (data = full row; deletes are rows with deleted=true)
 *
 * Conflict rule: last write wins on the client's `updatedAt`.
 * Pull cursor: a per-user sequence number, so no change is ever skipped even if
 * two writes land in the same millisecond.
 */
import { randomUUID } from 'node:crypto';
import { createGunzip } from 'node:zlib';

import bcrypt from 'bcryptjs';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

import { ensureOtaIndexes, findAsset, latestManifest, openAssetStream } from './ota.js';

export const SYNC_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'funds',
  'recurring_rules',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CHANGES_PER_REQUEST = 2000;
const MAX_PULL = 5000;

export async function ensureIndexes(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db
    .collection('records')
    .createIndex({ userId: 1, table: 1, id: 1 }, { unique: true, name: 'record_key' });
  await db.collection('records').createIndex({ userId: 1, seq: 1 }, { name: 'pull_cursor' });
  await ensureOtaIndexes(db);
}

/**
 * @param {object} opts
 * @param {import('mongodb').Db | (() => Promise<import('mongodb').Db>)} opts.db  db or lazy getter
 * @param {string} opts.jwtSecret
 */
export function buildApp({ db: dbOrGetter, jwtSecret, logger = true }) {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  const app = Fastify({ logger, bodyLimit: 10 * 1024 * 1024 });
  const getDb = typeof dbOrGetter === 'function' ? dbOrGetter : async () => dbOrGetter;
  const col = async (name) => (await getDb()).collection(name);

  const sign = (user) =>
    jwt.sign({ sub: String(user._id), email: user.email }, jwtSecret, { expiresIn: '180d' });

  const fail = (reply, code, message) => reply.code(code).send({ error: message });

  // Simple in-memory brute-force guard for auth routes (per IP, 20 tries / 15 min).
  const attempts = new Map();
  const limited = (ip) => {
    const now = Date.now();
    const a = attempts.get(ip) ?? { n: 0, reset: now + 15 * 60_000 };
    if (now > a.reset) Object.assign(a, { n: 0, reset: now + 15 * 60_000 });
    a.n++;
    attempts.set(ip, a);
    return a.n > 20;
  };

  const credentials = (body) => {
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? '');
    if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address' };
    if (password.length < 8) return { error: 'Password must be at least 8 characters' };
    return { email, password };
  };

  app.get('/health', async () => ({ ok: true, time: Date.now() }));

  app.post('/auth/register', async (req, reply) => {
    if (limited(req.ip)) return fail(reply, 429, 'Too many attempts. Try again later.');
    const c = credentials(req.body);
    if (c.error) return fail(reply, 400, c.error);
    const passwordHash = await bcrypt.hash(c.password, 10);
    try {
      const doc = { email: c.email, passwordHash, createdAt: new Date() };
      const res = await (await col('users')).insertOne(doc);
      return { token: sign({ _id: res.insertedId, email: c.email }), email: c.email };
    } catch (e) {
      if (e?.code === 11000) return fail(reply, 409, 'An account with this email already exists. Sign in instead.');
      throw e;
    }
  });

  app.post('/auth/login', async (req, reply) => {
    if (limited(req.ip)) return fail(reply, 429, 'Too many attempts. Try again later.');
    const c = credentials(req.body);
    if (c.error) return fail(reply, 400, c.error);
    const user = await (await col('users')).findOne({ email: c.email });
    if (!user || !(await bcrypt.compare(c.password, user.passwordHash))) {
      return fail(reply, 401, 'Wrong email or password');
    }
    return { token: sign(user), email: user.email };
  });

  const auth = async (req, reply) => {
    const h = req.headers.authorization ?? '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return fail(reply, 401, 'Sign in to sync');
    try {
      req.user = jwt.verify(token, jwtSecret);
    } catch {
      return fail(reply, 401, 'Session expired. Sign in again.');
    }
  };

  app.post('/sync', { preHandler: auth }, async (req, reply) => {
    const userId = req.user.sub;
    const cursor = Number(req.body?.cursor ?? 0);
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : null;
    if (!Number.isFinite(cursor) || cursor < 0) return fail(reply, 400, 'Invalid cursor');
    if (!changes) return fail(reply, 400, 'changes must be an array');
    if (changes.length > MAX_CHANGES_PER_REQUEST) {
      return fail(reply, 413, `Send at most ${MAX_CHANGES_PER_REQUEST} changes per request`);
    }
    for (const c of changes) {
      if (
        !SYNC_TABLES.includes(c?.table) ||
        typeof c.id !== 'string' ||
        !c.id ||
        !Number.isFinite(c.updatedAt) ||
        typeof c.data !== 'object' ||
        c.data === null
      ) {
        return fail(reply, 400, 'Malformed change');
      }
    }

    const records = await col('records');
    const counters = await col('counters');

    // ---- push: apply incoming changes (last write wins) ----
    let applied = 0;
    if (changes.length) {
      const { seq } = await counters.findOneAndUpdate(
        { _id: userId },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      const ops = changes.map((c) => ({
        updateOne: {
          // Only overwrite when the incoming row is newer than what we have.
          filter: {
            userId,
            table: c.table,
            id: c.id,
            updatedAt: { $lt: c.updatedAt },
          },
          update: { $set: { data: c.data, updatedAt: c.updatedAt, seq } },
        },
      }));
      const inserts = changes.map((c) => ({
        updateOne: {
          filter: { userId, table: c.table, id: c.id },
          update: {
            $setOnInsert: { userId, table: c.table, id: c.id, data: c.data, updatedAt: c.updatedAt, seq },
          },
          upsert: true,
        },
      }));
      const r1 = await records.bulkWrite(inserts, { ordered: false });
      const r2 = await records.bulkWrite(ops, { ordered: false });
      applied = r1.upsertedCount + r2.modifiedCount;
    }

    // ---- pull: everything changed since the client's cursor ----
    const docs = await records
      .find({ userId, seq: { $gt: cursor } })
      .sort({ seq: 1 })
      .limit(MAX_PULL)
      .toArray();
    const counter = await counters.findOne({ _id: userId });
    const more = docs.length === MAX_PULL;
    return {
      cursor: more ? docs[docs.length - 1].seq : (counter?.seq ?? 0),
      more,
      applied,
      changes: docs.map((d) => ({ table: d.table, id: d.id, updatedAt: d.updatedAt, data: d.data })),
    };
  });

  // ---------------------------------------------------------------------------
  // OTA updates (Expo Updates protocol v1). Published by scripts/publish-update.mjs
  // into MongoDB (see src/ota.js), so Git-triggered deploys never remove them.
  // ---------------------------------------------------------------------------
  app.get('/updates/manifest', async (req, reply) => {
    const platform = req.headers['expo-platform'] ?? req.query.platform;
    const runtimeVersion = req.headers['expo-runtime-version'] ?? req.query['runtime-version'];
    if (platform !== 'android' && platform !== 'ios') {
      return fail(reply, 400, 'Missing or invalid expo-platform');
    }
    if (!runtimeVersion || !/^[\w.-]+$/.test(String(runtimeVersion))) {
      return fail(reply, 400, 'Missing or invalid expo-runtime-version');
    }

    const stored = await latestManifest(await getDb(), String(runtimeVersion), platform);
    if (!stored) return fail(reply, 404, `No update published for runtime ${runtimeVersion}`);

    const proto = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https';
    const base = `${proto}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
    const abs = (a) => ({ ...a, url: `${base}${a.url}` });
    const manifest = {
      ...stored,
      launchAsset: abs(stored.launchAsset),
      assets: stored.assets.map(abs),
    };

    const CRLF = '\r\n';
    const boundary = `----expo-${randomUUID()}`;
    const part = (name, body) =>
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="${name}"${CRLF}` +
      `Content-Type: application/json; charset=utf-8${CRLF}${CRLF}` +
      `${JSON.stringify(body)}${CRLF}`;
    const payload =
      part('manifest', manifest) +
      part('extensions', { assetRequestHeaders: {} }) +
      `--${boundary}--${CRLF}`;

    reply
      .header('expo-protocol-version', 1)
      .header('expo-sfv-version', 0)
      .header('cache-control', 'private, max-age=0')
      .header('content-type', `multipart/mixed; boundary=${boundary}`)
      .send(payload);
  });

  app.get('/ota/assets/:key', async (req, reply) => {
    const key = String(req.params.key);
    if (!/^[a-f0-9]{32}$/.test(key)) return fail(reply, 400, 'Invalid asset key');
    const db = await getDb();
    const file = await findAsset(db, key);
    if (!file) return fail(reply, 404, 'Asset not found');

    const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    const stream = openAssetStream(db, file._id);
    reply
      .header('content-type', file.metadata?.contentType ?? 'application/octet-stream')
      .header('cache-control', 'public, max-age=31536000, immutable');
    if (acceptsGzip) {
      reply.header('content-encoding', 'gzip').header('vary', 'accept-encoding');
      return reply.send(stream);
    }
    return reply.send(stream.pipe(createGunzip()));
  });

  app.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    const code = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    reply.code(code).send({ error: code === 500 ? 'Server error. Try again.' : err.message });
  });

  return app;
}
