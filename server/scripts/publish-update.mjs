#!/usr/bin/env node
/**
 * Publishes an over-the-air (OTA) update of the mobile app to MongoDB Atlas.
 *
 *   npm run publish-update -- --message "Fix budget alert text"  [--ios]
 *
 * 1. `expo export` bundles the app's JS + assets (temporary folder)
 * 2. Uploads each file gzip-compressed to GridFS (skips files already stored)
 * 3. Saves the manifest in `ota_updates` and keeps the newest 3 per runtime/platform
 *
 * No Vercel deploy is needed: the live server reads updates from the database. Phones
 * running a build with the same runtime version (mobile/app.json "version") download it
 * the next time the app opens. After adding a native module, bump "version" and build a
 * new APK instead.
 */
import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { MongoClient } from 'mongodb';

import { ensureOtaIndexes, otaStore, pruneUpdates } from '../src/ota.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(here, '..', '..', 'mobile');
const args = process.argv.slice(2);
const messageIdx = args.indexOf('--message');
const message = messageIdx >= 0 ? (args[messageIdx + 1] ?? '') : '';
const platforms = args.includes('--ios') ? ['android', 'ios'] : ['android'];
const MAX_GZIP_BYTES = 4 * 1024 * 1024; // stay under Vercel's 4.5 MB response limit

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
};

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}`);
  const r = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Command failed (${r.status}): ${cmd}`);
}
function capture(cmd, cwd) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`Command failed: ${cmd}\n${r.stderr}`);
  return r.stdout;
}
const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set in server/.env');

// ---- 1. runtime version + public config --------------------------------------------------
const expoConfig = JSON.parse(capture('npx expo config --type public --json', mobileDir));
const runtimeVersion =
  typeof expoConfig.runtimeVersion === 'string' ? expoConfig.runtimeVersion : expoConfig.version;
if (!runtimeVersion) throw new Error('Could not determine runtime version from app.json');

const updateId = randomUUID();
const createdAt = new Date();
const exportDir = mkdtempSync(path.join(tmpdir(), 'bt-ota-'));
console.log(`Publishing update ${updateId} for runtime ${runtimeVersion} (${platforms.join(', ')})`);

const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  // ---- 2. bundle -------------------------------------------------------------------------
  run(
    `npx expo export ${platforms.map((p) => `--platform ${p}`).join(' ')} --output-dir "${exportDir}"`,
    mobileDir,
  );
  const metadata = JSON.parse(readFileSync(path.join(exportDir, 'metadata.json'), 'utf8'));

  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? 'budget_tracker');
  await ensureOtaIndexes(db);
  const { updates, files, bucket } = otaStore(db);

  let uploaded = 0;
  let reused = 0;
  const store = async (relPath, ext, isLaunch) => {
    const raw = readFileSync(path.join(exportDir, relPath));
    const key = createHash('md5').update(raw).digest('hex');
    const contentType = isLaunch
      ? 'application/javascript'
      : (MIME[ext] ?? 'application/octet-stream');
    if (await files.findOne({ filename: key }, { projection: { _id: 1 } })) {
      reused++;
    } else {
      const gz = gzipSync(raw, { level: 9 });
      if (gz.length > MAX_GZIP_BYTES) {
        throw new Error(`${relPath} is ${(gz.length / 1e6).toFixed(1)} MB gzipped; too large to serve`);
      }
      await new Promise((resolve, reject) => {
        const up = bucket.openUploadStream(key, { metadata: { contentType, encoding: 'gzip' } });
        up.on('finish', resolve).on('error', reject);
        up.end(gz);
      });
      uploaded++;
      if (isLaunch) {
        console.log(`  bundle ${(raw.length / 1e6).toFixed(1)} MB → ${(gz.length / 1e6).toFixed(1)} MB gzipped`);
      }
    }
    return {
      hash: base64url(createHash('sha256').update(raw).digest()),
      key,
      contentType,
      fileExtension: isLaunch ? '.bundle' : `.${ext}`,
      url: `/ota/assets/${key}`,
    };
  };

  // ---- 3. manifests ----------------------------------------------------------------------
  for (const platform of platforms) {
    const meta = metadata.fileMetadata[platform];
    if (!meta) throw new Error(`No ${platform} bundle in export`);
    const launchAsset = await store(meta.bundle, null, true);
    const assets = [];
    for (const a of meta.assets) assets.push(await store(a.path, a.ext, false));
    const manifest = {
      id: updateId,
      createdAt: createdAt.toISOString(),
      runtimeVersion,
      launchAsset,
      assets,
      metadata: message ? { message } : {},
      extra: { expoClient: expoConfig },
    };
    await updates.insertOne({ updateId, runtimeVersion, platform, createdAt, message, manifest });
    console.log(`✔ ${platform}: ${assets.length} assets`);
  }
  console.log(`  files uploaded ${uploaded}, reused ${reused}`);

  // ---- 4. prune ----------------------------------------------------------------------------
  const removed = await pruneUpdates(db);
  if (removed) console.log(`  removed ${removed} files no longer used`);

  console.log(`\n✔ Update ${updateId} is live. Phones get it the next time the app opens.`);
} finally {
  await client.close();
  rmSync(exportDir, { recursive: true, force: true });
}
