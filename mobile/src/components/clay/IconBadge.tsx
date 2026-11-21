import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Rounded square holding an icon on a soft tint of its colour. */
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
        borderRadius: Math.round(size * 0.3),
        backgroundColor: color + (t.scheme === 'dark' ? '2E' : '1A'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons
        name={(name in Ionicons.glyphMap ? name : 'pricetag') as IconName}
        size={Math.round(size * 0.5)}
        color={color}
      />
    </View>
  );
}
