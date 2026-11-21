import { useEffect } from 'react';
import { Appearance } from 'react-native';

import { usePrefs } from './repo';

/** Applies the Appearance setting (System / Light / Night) app-wide. */
export function ThemeModeSync() {
  const { themeMode } = usePrefs();
  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [themeMode]);
  return null;
}
