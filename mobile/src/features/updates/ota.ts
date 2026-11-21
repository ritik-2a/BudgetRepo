import * as Updates from 'expo-updates';

export type OtaStatus =
  | { kind: 'disabled'; reason: string }
  | { kind: 'up-to-date' }
  | { kind: 'downloaded'; message?: string };

/** Human-readable description of the code currently running. */
export function currentVersionLabel(): string {
  if (!Updates.isEnabled) return 'Development build';
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return 'Built-in version';
  const d = Updates.createdAt;
  return `Update from ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Checks the update server and downloads a new update if there is one. */
export async function checkAndDownload(): Promise<OtaStatus> {
  if (!Updates.isEnabled) {
    return { kind: 'disabled', reason: 'Updates are off in development. Use the installed APK.' };
  }
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return { kind: 'up-to-date' };
  const fetched = await Updates.fetchUpdateAsync();
  if (!fetched.isNew) return { kind: 'up-to-date' };
  const meta = (fetched.manifest as { metadata?: { message?: string } } | undefined)?.metadata;
  return { kind: 'downloaded', message: meta?.message };
}

/** Restarts the app on the downloaded update. */
export async function applyUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

export { Updates };
