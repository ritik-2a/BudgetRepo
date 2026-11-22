import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Brand colours for the premium full-screen surfaces (same in light and dark mode). */
export const BRAND = {
  deep: '#06201D',
  mid: '#0B3B36',
  teal: '#12806F',
  glow: '#3CC3AA',
  gold: '#F2C14E',
  text: '#F2FBF8',
  textMuted: 'rgba(226, 244, 239, 0.66)',
  hairline: 'rgba(226, 244, 239, 0.10)',
};

/**
 * Full-screen deep-teal backdrop: vertical gradient, two soft light pools and fine
 * concentric rings centred at `focusY` (fraction of screen height) behind the logo.
 */
export function BrandBackdrop({ focusY = 0.36 }: { focusY?: number }) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height * focusY;
  const rings = [70, 118, 172, 232, 300];

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={BRAND.mid} />
          <Stop offset="0.55" stopColor="#082B27" />
          <Stop offset="1" stopColor={BRAND.deep} />
        </LinearGradient>
        <RadialGradient id="glowTop" cx="50%" cy={`${focusY * 100}%`} r="55%">
          <Stop offset="0" stopColor={BRAND.glow} stopOpacity="0.30" />
          <Stop offset="0.6" stopColor={BRAND.glow} stopOpacity="0.04" />
          <Stop offset="1" stopColor={BRAND.glow} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glowGold" cx="85%" cy="100%" r="60%">
          <Stop offset="0" stopColor={BRAND.gold} stopOpacity="0.16" />
          <Stop offset="1" stopColor={BRAND.gold} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#bg)" />
      <Rect width={width} height={height} fill="url(#glowTop)" />
      <Rect width={width} height={height} fill="url(#glowGold)" />
      {rings.map((r, i) => (
        <Circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          stroke="#E2F4EF"
          strokeOpacity={0.09 - i * 0.014}
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
}
