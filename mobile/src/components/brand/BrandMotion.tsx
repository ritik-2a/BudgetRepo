import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { BRAND } from './BrandBackdrop';

/** One ring that grows outward and fades (radiating, no vertical movement). */
function Ripple({ size, delay, color }: { size: number; delay: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.cubic) }), -1, false),
    );
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.value),
    transform: [{ scale: 1 + p.value * 0.75 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: size / 2, borderWidth: 1.5, borderColor: color },
        style,
      ]}
    />
  );
}

/** Radiating rings behind a circular element of `size`. */
export function PulseRings({ size, color = BRAND.glow }: { size: number; color?: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: size, height: size }]}>
      <Ripple size={size} delay={0} color={color} />
      <Ripple size={size} delay={800} color={color} />
      <Ripple size={size} delay={1600} color={color} />
    </View>
  );
}

/** Thin gold arc orbiting around an element of `size` (premium loader). */
export function OrbitArc({ size, stroke = 2.5 }: { size: number; stroke?: number }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={BRAND.gold} stopOpacity="1" />
            <Stop offset="1" stopColor={BRAND.gold} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={BRAND.hairline}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#arc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.28} ${circumference}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
