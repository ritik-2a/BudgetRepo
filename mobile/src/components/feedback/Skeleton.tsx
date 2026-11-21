import { useEffect } from 'react';
import { View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ClayCard } from '@/components/clay';
import { useTheme } from '@/theme';

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: t.colors.surfaceSunken },
        style,
        animated,
      ]}
    />
  );
}

/** Skeleton for a list of rows (icon + two text lines + amount). */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <ClayCard style={{ gap: 18 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Skeleton width={40} height={40} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" />
            <Skeleton width="35%" height={10} />
          </View>
          <Skeleton width={64} />
        </View>
      ))}
    </ClayCard>
  );
}
