import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ClayInput,
  IconBadge,
  Screen,
  SegmentedControl,
  SwitchRow,
} from '@/components/clay';
import { Banner, InlineLoader, useConfirm, useToast } from '@/components/feedback';
import { setPref, usePrefs } from '@/features/settings/repo';
import { clearToken, getToken, normalizeServerUrl, request, setToken } from '@/features/sync/api';
import { resetSyncState, syncNow } from '@/features/sync/engine';
import { formatDate } from '@/lib/dates';
import { useTheme } from '@/theme';

function timeAgo(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return formatDate(new Date(ms));
}

export default function SyncScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const prefs = usePrefs();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [server, setServer] = useState(prefs.syncServerUrl || '');
  const [email, setEmail] = useState(prefs.syncEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'test' | 'auth' | 'sync'>(null);

  useEffect(() => {
    getToken()
      .then((tk) => setSignedIn(!!tk))
      .catch(() => setSignedIn(false));
  }, []);

  const testConnection = async () => {
    const url = normalizeServerUrl(server);
    if (!url) return toast.error('Enter the server address first');
    setBusy('test');
    try {
      await request(url, '/health', { method: 'GET', timeoutMs: 8000 });
      setServer(url);
      toast.success('Server reachable', url);
    } catch (e) {
      toast.error("Couldn't connect", e);
    } finally {
      setBusy(null);
    }
  };

  const authenticate = async () => {
    const url = normalizeServerUrl(server);
    if (!url) return toast.error('Enter the server address first');
    setBusy('auth');
    try {
      const res = await request<{ token: string; email: string }>(
        url,
        mode === 'login' ? '/auth/login' : '/auth/register',
        { body: { email, password } },
      );
      await setToken(res.token);
      setPref('syncServerUrl', url);
      setPref('syncEmail', res.email);
      setPassword('');
      setSignedIn(true);
      toast.success(mode === 'login' ? 'Signed in' : 'Account created', res.email);
      await runSync(true);
    } catch (e) {
      toast.error(mode === 'login' ? "Couldn't sign in" : "Couldn't create account", e);
    } finally {
      setBusy(null);
    }
  };

  const runSync = async (afterLogin = false) => {
    setBusy('sync');
    try {
      const r = await syncNow();
      toast.success(
        'Sync complete',
        r.replacedDefaults
          ? `Downloaded your data from the cloud (${r.pulled} items).`
          : `Uploaded ${r.pushed} · downloaded ${r.pulled} change${r.pulled === 1 ? '' : 's'}.`,
      );
    } catch (e) {
      toast.error(afterLogin ? 'Signed in, but the first sync failed' : 'Sync failed', e);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Sign out of cloud sync?',
      message:
        'Your data stays on this phone and in the cloud. This phone just stops syncing until you sign in again.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    await clearToken();
    resetSyncState();
    setSignedIn(false);
    toast.info('Signed out of sync');
  };

  if (signedIn === null) {
    return (
      <Screen title="Cloud sync" back>
        <InlineLoader />
      </Screen>
    );
  }

  if (signedIn) {
    return (
      <Screen title="Cloud sync" back>
        <ClayCard style={styles.center}>
          <IconBadge name="cloud-done" color={t.colors.income} size={60} />
          <AppText variant="title">Sync is on</AppText>
          <AppText variant="caption" muted>
            {prefs.syncEmail}
          </AppText>
          <AppText variant="caption" muted>
            Last synced: {prefs.syncLastAt ? timeAgo(prefs.syncLastAt) : 'never'}
          </AppText>
          <ClayButton
            title="Sync now"
            icon="sync"
            loading={busy === 'sync'}
            onPress={() => runSync()}
          />
        </ClayCard>
        <ClayCard style={styles.gap}>
          <SwitchRow
            icon="refresh"
            title="Sync automatically"
            subtitle="When the app opens or comes back to the screen"
            value={prefs.syncAuto}
            onChange={(v) => setPref('syncAuto', v)}
          />
          <AppText variant="caption" muted>
            Server: {prefs.syncServerUrl}
          </AppText>
        </ClayCard>
        <Banner
          tone="info"
          message="Sign in with the same email on another phone to get the same data there. App settings like reminders and app lock stay per phone."
        />
        <ClayButton
          title="Sign out"
          icon="log-out"
          variant="secondary"
          fullWidth
          onPress={signOut}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Cloud sync" back>
      <Banner
        tone="info"
        title="Back up and sync your data"
        message="Your data is saved to your MongoDB Atlas database through the Budget Tracker server, and stays in sync across your phones."
      />

      <ClayCard style={styles.gap}>
        <ClayInput
          label="Server address"
          value={server}
          onChangeText={setServer}
          placeholder="e.g. 192.168.1.9:4000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <AppText variant="caption" muted>
          While testing at home, this is your PC&apos;s Wi-Fi address with port 4000. The server
          must be running on the PC.
        </AppText>
        <ClayButton
          title="Test connection"
          icon="pulse"
          variant="secondary"
          loading={busy === 'test'}
          onPress={testConnection}
        />
      </ClayCard>

      <ClayCard style={styles.gap}>
        <SegmentedControl
          options={[
            { value: 'login', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <ClayInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <ClayInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
        />
        <ClayButton
          title={mode === 'login' ? 'Sign in & sync' : 'Create account & sync'}
          icon="cloud-upload"
          fullWidth
          loading={busy === 'auth' || busy === 'sync'}
          onPress={authenticate}
        />
      </ClayCard>
      <View style={styles.gap}>
        <AppText variant="caption" muted>
          This account is only for the sync server. It is separate from your MongoDB login.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 8 },
  gap: { gap: 12 },
});
