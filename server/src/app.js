/**
 * Budget Tracker sync API.
 *
 *   POST /auth/register  { email, password }          -> { token, email }
 *   POST /auth/login     { email, password }          -> { token, email }
 *   POST /sync           { cursor, changes: Change[] } -> { cursor, changes: Change[] }   (Bearer token)
 *   GET  /health
 *
 * Change = { table, id, updatedAt, data }   (data = full row; deletes are rows with deleted=true)
 *
 * Conflict rule: last write wins on the client's `updatedAt`.
 * Pull cursor: a per-user sequence number, so no change is ever skipped even if
 * two writes land in the same millisecond.
 */
import bcrypt from 'bcryptjs';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

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
}

export function buildApp({ db, jwtSecret, logger = true }) {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 chars');
  const app = Fastify({ logger, bodyLimit: 10 * 1024 * 1024 });
  const users = db.collection('users');
  const records = db.collection('records');
  const counters = db.collection('counters');

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
      const res = await users.insertOne(doc);
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
    const user = await users.findOne({ email: c.email });
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

  app.setErrorHandler((err, req, reply) => {
    req.log.error(err);
    const code = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    reply.code(code).send({ error: code === 500 ? 'Server error. Try again.' : err.message });
  });

  return app;
}
