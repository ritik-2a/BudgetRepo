#!/usr/bin/env node
/**
 * Publishes an over-the-air (OTA) update of the mobile app.
 *
 *   node scripts/publish-update.mjs [--deploy] [--ios] [--message "Fix budget alert text"]
 *
 * 1. `expo export` bundles the app's JS + assets into public/ota/<runtime>/<updateId>/
 * 2. Writes updates/<runtime>/<platform>.json (the Expo Updates manifest the server returns)
 * 3. Keeps only the 3 newest updates per runtime
 * 4. With --deploy, runs `vercel deploy --prod`
 *
 * Phones running a build with the same runtime version (app.json "version") download the
 * update the next time the app opens. If you add a native module, bump "version" in
 * app.json and build a new APK instead.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const mobileDir = path.resolve(serverDir, '..', 'mobile');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const messageIdx = args.indexOf('--message');
const message = messageIdx >= 0 ? args[messageIdx + 1] : '';
const platforms = flag('--ios') ? ['android', 'ios'] : ['android'];
const KEEP = 3;

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

function assetMeta(exportDir, urlPrefix, relPath, ext, isLaunch) {
  const file = readFileSync(path.join(exportDir, relPath));
  return {
    hash: base64url(createHash('sha256').update(file).digest()),
    key: createHash('md5').update(file).digest('hex'),
    contentType: isLaunch ? 'application/javascript' : (MIME[ext] ?? 'application/octet-stream'),
    fileExtension: isLaunch ? '.bundle' : `.${ext}`,
    url: `${urlPrefix}/${relPath.replace(/\\/g, '/')}`,
  };
}

// ---- 1. runtime version + public config ------------------------------------------------
const expoConfig = JSON.parse(capture('npx expo config --type public --json', mobileDir));
const runtimeVersion =
  typeof expoConfig.runtimeVersion === 'string' ? expoConfig.runtimeVersion : expoConfig.version;
if (!runtimeVersion) throw new Error('Could not determine runtime version from app.json');

const updateId = randomUUID();
const createdAt = new Date().toISOString();
const runtimeOtaDir = path.join(serverDir, 'public', 'ota', runtimeVersion);
const exportDir = path.join(runtimeOtaDir, updateId);
const urlPrefix = `/ota/${runtimeVersion}/${updateId}`;

console.log(`Publishing update ${updateId} for runtime ${runtimeVersion} (${platforms.join(', ')})`);

// ---- 2. bundle ----------------------------------------------------------------------------
run(
  `npx expo export ${platforms.map((p) => `--platform ${p}`).join(' ')} --output-dir "${exportDir}"`,
  mobileDir,
);
const metadata = JSON.parse(readFileSync(path.join(exportDir, 'metadata.json'), 'utf8'));

// ---- 3. manifests -------------------------------------------------------------------------
const manifestDir = path.join(serverDir, 'updates', runtimeVersion);
mkdirSync(manifestDir, { recursive: true });
for (const platform of platforms) {
  const meta = metadata.fileMetadata[platform];
  if (!meta) throw new Error(`No ${platform} bundle in export`);
  const manifest = {
    id: updateId,
    createdAt,
    runtimeVersion,
    launchAsset: assetMeta(exportDir, urlPrefix, meta.bundle, null, true),
    assets: meta.assets.map((a) => assetMeta(exportDir, urlPrefix, a.path, a.ext, false)),
    metadata: message ? { message } : {},
    extra: { expoClient: expoConfig },
  };
  writeFileSync(path.join(manifestDir, `${platform}.json`), JSON.stringify(manifest));
  console.log(`✔ ${platform}: ${manifest.assets.length} assets`);
}

// ---- 4. prune old updates -------------------------------------------------------------------
if (existsSync(runtimeOtaDir)) {
  const dirs = readdirSync(runtimeOtaDir)
    .map((name) => ({ name, t: statSync(path.join(runtimeOtaDir, name)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const d of dirs.slice(KEEP)) rmSync(path.join(runtimeOtaDir, d.name), { recursive: true });
}

// ---- 5. deploy ------------------------------------------------------------------------------
if (flag('--deploy')) {
  run('npx vercel deploy --prod --yes', serverDir);
  console.log(`\n✔ Update ${updateId} is live. Phones get it the next time the app opens.`);
} else {
  console.log('\nUpdate prepared. Deploy with:  npx vercel deploy --prod');
}
