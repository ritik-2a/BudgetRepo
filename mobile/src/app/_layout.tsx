import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ConfirmProvider, FullScreenError, ToastProvider } from '@/components/feedback';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { AppLockGate } from '@/features/security/AppLock';
import { StartupTasks } from '@/features/startup/StartupTasks';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Catches any crash while rendering a screen and shows the error text with a
 * "Try again" button instead of a blank/white screen.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <FullScreenError
      title="This screen crashed"
      message="Something unexpected happened. Your data is safe. Tap Try again to reload the screen."
      error={error}
      onRetry={() => void retry()}
    />
  );
}

export default function RootLayout() {
  const t = useTheme();
  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.text,
      primary: t.colors.primary,
      border: t.colors.border,
    },
  };

  useEffect(() => {
    // Hand over from the native splash to our own loader immediately (never a blank screen).
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <ToastProvider>
        <ConfirmProvider>
          <DatabaseProvider>
            <AppLockGate>
              <StartupTasks />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: t.colors.background },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
              </Stack>
            </AppLockGate>
          </DatabaseProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
