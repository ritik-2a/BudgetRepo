import type { IconName } from '@/components/clay';
import { useTheme } from '@/theme';

export type Tone = 'success' | 'error' | 'warning' | 'info';

export function useToneColors(tone: Tone): { color: string; icon: IconName } {
  const { colors } = useTheme();
  switch (tone) {
    case 'success':
      return { color: colors.income, icon: 'checkmark-circle' };
    case 'error':
      return { color: colors.danger, icon: 'alert-circle' };
    case 'warning':
      return { color: colors.warning, icon: 'warning' };
    default:
      return { color: colors.primary, icon: 'information-circle' };
  }
}
