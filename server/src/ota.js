/**
 * OTA update storage in MongoDB.
 *
 *  - `ota_updates`: one document per published update and platform, holding its manifest.
 *  - GridFS bucket `ota`: the bundle and assets, gzip-compressed, named by their MD5 key
 *    (shared between updates, so unchanged images are stored once).
 *
 * Files are stored gzipped so the ~5 MB Hermes bundle fits in Vercel's 4.5 MB response limit;
 * phones send `Accept-Encoding: gzip` and decompress transparently.
 */
import { GridFSBucket } from 'mongodb';

export const KEEP_UPDATES = 3;

export function otaStore(db) {
  return {
    updates: db.collection('ota_updates'),
    files: db.collection('ota.files'),
    bucket: new GridFSBucket(db, { bucketName: 'ota' }),
  };
}

export async function ensureOtaIndexes(db) {
  await db
    .collection('ota_updates')
    .createIndex({ runtimeVersion: 1, platform: 1, createdAt: -1 }, { name: 'latest_update' });
}

/** Latest manifest for a runtime/platform, or null. Asset URLs are relative (/ota/assets/<key>). */
export async function latestManifest(db, runtimeVersion, platform) {
  const doc = await otaStore(db)
    .updates.find({ runtimeVersion, platform })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  return doc?.manifest ?? null;
}

/** Looks up a stored asset by key. */
export async function findAsset(db, key) {
  return otaStore(db).files.findOne({ filename: key });
}

export function openAssetStream(db, fileId) {
  return otaStore(db).bucket.openDownloadStream(fileId);
}

/** Deletes updates beyond the newest KEEP_UPDATES per runtime/platform, then orphaned files. */
export async function pruneUpdates(db) {
  const { updates, files, bucket } = otaStore(db);
  const groups = await updates
    .aggregate([{ $group: { _id: { r: '$runtimeVersion', p: '$platform' } } }])
    .toArray();
  for (const g of groups) {
    const old = await updates
      .find({ runtimeVersion: g._id.r, platform: g._id.p })
      .sort({ createdAt: -1 })
      .skip(KEEP_UPDATES)
      .project({ _id: 1 })
      .toArray();
    if (old.length) await updates.deleteMany({ _id: { $in: old.map((o) => o._id) } });
  }
  const live = new Set();
  for await (const u of updates.find({}, { projection: { 'manifest.launchAsset.key': 1, 'manifest.assets.key': 1 } })) {
    live.add(u.manifest.launchAsset.key);
    for (const a of u.manifest.assets) live.add(a.key);
  }
  let removed = 0;
  for await (const f of files.find({}, { projection: { filename: 1 } })) {
    if (!live.has(f.filename)) {
      await bucket.delete(f._id);
      removed++;
    }
  }
  return removed;
}
