import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Small rounded clay "blob" holding an icon, tinted with a category/account colour. */
export function IconBadge({
  name,
  color,
  size = 40,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.38,
        backgroundColor: color + (t.scheme === 'dark' ? '33' : '26'),
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `inset 2px 2px 4px ${t.colors.highlight}, inset -2px -2px 4px ${t.colors.innerShade}`,
      }}
    >
      <Ionicons
        name={(name in Ionicons.glyphMap ? name : 'pricetag') as IconName}
        size={size * 0.5}
        color={color}
      />
    </View>
  );
}
