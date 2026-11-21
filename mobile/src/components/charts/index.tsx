/**
 * Lightweight charts on react-native-svg.
 *
 * Conventions (see dataviz guidance): thin marks with rounded data ends anchored to
 * the baseline, recessive grid/axes, text in text colours (never the series colour),
 * a legend whenever there are ≥2 series, and tap-to-inspect instead of hover.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/clay';
import { formatINR, formatINRCompact } from '@/lib/money';
import { useTheme } from '@/theme';

function useWidth(initial = 300) {
  const [width, setWidth] = useState(initial);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  return { width, onLayout };
}

function EmptyChart({ height }: { height: number }) {
  const t = useTheme();
  return (
    <View style={[styles.emptyChart, { height, borderColor: t.colors.border }]}>
      <AppText variant="caption" muted>
        Nothing to chart yet. Data appears as you add transactions.
      </AppText>
    </View>
  );
}

/** "Nice" axis maximum: 1, 2, 2.5, 5 × 10^n above the data max. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}

/* ------------------------------------------------------------------ */
/* Bar chart (single series)                                           */
/* ------------------------------------------------------------------ */

export type BarDatum = { label: string; value: number };

export function BarChart({
  data,
  color,
  height = 180,
  accessibilityLabel,
  highlightLast = true,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  accessibilityLabel: string;
  highlightLast?: boolean;
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const barColor = color ?? t.colors.primary;

  const padLeft = 44;
  const padBottom = 22;
  const padTop = 22;
  const plotW = width - padLeft;
  const plotH = height - padBottom - padTop;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(28, slot * 0.55);
  const ticks = [0, 0.5, 1];

  const active = selected ?? (highlightLast ? data.length - 1 : null);
  if (data.every((d) => d.value === 0)) return <EmptyChart height={height} />;

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {ticks.map((tk) => {
          const y = padTop + plotH - tk * plotH;
          return (
            <G key={tk}>
              <Line
                x1={padLeft}
                x2={width}
                y1={y}
                y2={y}
                stroke={t.colors.border}
                strokeWidth={1}
                strokeDasharray={tk === 0 ? undefined : '3 4'}
              />
              <SvgText
                x={padLeft - 6}
                y={y + 4}
                fontSize={10}
                fill={t.colors.textMuted}
                textAnchor="end"
              >
                {formatINRCompact(max * tk * 1)}
              </SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const h = max > 0 ? (d.value / max) * plotH : 0;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const y = padTop + plotH - h;
          const r = Math.min(4, h / 2, barW / 2);
          const isActive = i === active;
          // Rounded top corners only, square at the baseline.
          const path =
            h <= 0
              ? ''
              : `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${y + h} Z`;
          return (
            <G key={i}>
              {path ? (
                <Path d={path} fill={barColor} opacity={active === null || isActive ? 1 : 0.45} />
              ) : null}
              {isActive && d.value > 0 ? (
                <SvgText
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize={11}
                  fontWeight="700"
                  fill={t.colors.text}
                  textAnchor="middle"
                >
                  {formatINRCompact(d.value)}
                </SvgText>
              ) : null}
              <SvgText
                x={x + barW / 2}
                y={height - 6}
                fontSize={10}
                fill={isActive ? t.colors.text : t.colors.textMuted}
                fontWeight={isActive ? '700' : '400'}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {/* Hit targets: whole column, larger than the bar */}
      <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: padLeft }]}>
        {data.map((d, i) => (
          <Pressable
            key={i}
            style={styles.flex}
            onPress={() => setSelected(selected === i ? null : i)}
            accessibilityRole="button"
            accessibilityLabel={`${d.label}: ${formatINR(d.value)}`}
          />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Donut chart                                                         */
/* ------------------------------------------------------------------ */

export type DonutSegment = { key: string; label: string; value: number; color: string };

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const sx = cx + r * Math.cos(start);
  const sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(end);
  const ey = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey}`;
}

/**
 * Donut with a legend (name · amount · %). Shows the top `maxSegments` and folds
 * the rest into "Other" so colours are never cycled.
 */
export function DonutChart({
  segments,
  centerLabel,
  size = 190,
  maxSegments = 6,
  onSelect,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  size?: number;
  maxSegments?: number;
  onSelect?: (key: string) => void;
}) {
  const t = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...segments].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, maxSegments);
  const rest = sorted.slice(maxSegments);
  if (rest.length) {
    top.push({
      key: '__other',
      label: `Other (${rest.length})`,
      value: rest.reduce((s, r) => s + r.value, 0),
      color: t.colors.textMuted,
    });
  }
  const total = top.reduce((s, x) => s + x.value, 0);

  const stroke = 22;
  const r = size / 2 - stroke / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const gap = top.length > 1 ? 0.035 : 0; // 2px-ish surface gap between segments

  const arcs = top.map((seg, i) => {
    const before = top.slice(0, i).reduce((acc, x) => acc + x.value, 0);
    const startAngle = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const sweep = (seg.value / total) * Math.PI * 2;
    return { ...seg, start: startAngle + gap / 2, end: startAngle + sweep - gap / 2 };
  });

  const sel = top.find((s) => s.key === selected);

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size }} accessible accessibilityLabel={centerLabel}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={t.colors.surfaceSunken}
            strokeWidth={stroke}
            fill="none"
          />
          {arcs.length === 1 ? (
            <Circle cx={cx} cy={cy} r={r} stroke={arcs[0].color} strokeWidth={stroke} fill="none" />
          ) : (
            arcs.map((a) => (
              <Path
                key={a.key}
                d={arcPath(cx, cy, r, a.start, Math.max(a.start + 0.001, a.end))}
                stroke={a.color}
                strokeWidth={selected === a.key ? stroke + 6 : stroke}
                strokeLinecap="butt"
                fill="none"
                opacity={selected && selected !== a.key ? 0.4 : 1}
              />
            ))
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.donutCenter]} pointerEvents="none">
          <AppText variant="caption" muted numberOfLines={1}>
            {sel ? sel.label : centerLabel}
          </AppText>
          <AppText
            variant="title"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={styles.centerValue}
          >
            {formatINR(sel ? sel.value : total)}
          </AppText>
          {sel ? (
            <AppText variant="caption" muted>
              {Math.round((sel.value / total) * 100)}%
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.legend}>
        {top.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => {
              setSelected(selected === s.key ? null : s.key);
              if (s.key !== '__other') onSelect?.(s.key);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}: ${formatINR(s.value)}, ${Math.round((s.value / total) * 100)} percent`}
            style={[
              styles.legendRow,
              selected === s.key && { backgroundColor: t.colors.surfaceSunken },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <AppText variant="caption" style={styles.flex} numberOfLines={1}>
              {s.label}
            </AppText>
            <AppText variant="caption" weight="600">
              {formatINR(s.value)}
            </AppText>
            <AppText variant="caption" muted style={styles.pct}>
              {Math.round((s.value / total) * 100)}%
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Line / area chart (single series)                                   */
/* ------------------------------------------------------------------ */

export function LineChart({
  data,
  color,
  height = 170,
  accessibilityLabel,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const lineColor = color ?? t.colors.primary;

  const padLeft = 44;
  const padRight = 10;
  const padBottom = 22;
  const padTop = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const n = data.length;
  const x = (i: number) => padLeft + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padTop + plotH - (max > 0 ? (v / max) * plotH : 0);

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');
  const area = n ? `${line} L${x(n - 1)},${padTop + plotH} L${x(0)},${padTop + plotH} Z` : '';
  const active = selected ?? n - 1;
  if (data.every((d) => d.value === 0)) return <EmptyChart height={height} />;
  const labelEvery = Math.ceil(n / 6);

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((tk) => {
          const yy = padTop + plotH - tk * plotH;
          return (
            <G key={tk}>
              <Line
                x1={padLeft}
                x2={width - padRight}
                y1={yy}
                y2={yy}
                stroke={t.colors.border}
                strokeDasharray={tk === 0 ? undefined : '3 4'}
              />
              <SvgText
                x={padLeft - 6}
                y={yy + 4}
                fontSize={10}
                fill={t.colors.textMuted}
                textAnchor="end"
              >
                {formatINRCompact(max * tk)}
              </SvgText>
            </G>
          );
        })}
        {n > 0 ? (
          <>
            <Path d={area} fill={lineColor} opacity={0.12} />
            <Path d={line} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Line
              x1={x(active)}
              x2={x(active)}
              y1={padTop}
              y2={padTop + plotH}
              stroke={t.colors.textMuted}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            <Circle
              cx={x(active)}
              cy={y(data[active].value)}
              r={5}
              fill={lineColor}
              stroke={t.colors.surface}
              strokeWidth={2}
            />
            <SvgText
              x={Math.min(Math.max(x(active), padLeft + 30), width - padRight - 30)}
              y={Math.max(12, y(data[active].value) - 10)}
              fontSize={11}
              fontWeight="700"
              fill={t.colors.text}
              textAnchor="middle"
            >
              {formatINRCompact(data[active].value)}
            </SvgText>
          </>
        ) : null}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <SvgText
              key={i}
              x={x(i)}
              y={height - 6}
              fontSize={10}
              fill={i === active ? t.colors.text : t.colors.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: padLeft - 10, right: 0 }]}>
        {data.map((d, i) => (
          <Pressable
            key={i}
            style={styles.flex}
            onPress={() => setSelected(i)}
            accessibilityRole="button"
            accessibilityLabel={`${d.label}: ${formatINR(d.value)}`}
          />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal comparison bars (e.g. Auto vs Metro)                     */
/* ------------------------------------------------------------------ */

export function HBarList({
  items,
}: {
  items: { key: string; label: string; value: number; color: string; sub?: string }[];
}) {
  const t = useTheme();
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <View style={styles.hbars}>
      {items.map((i) => (
        <View
          key={i.key}
          style={styles.hbarRow}
          accessible
          accessibilityLabel={`${i.label}: ${formatINR(i.value)}${i.sub ? `, ${i.sub}` : ''}`}
        >
          <View style={styles.hbarLabels}>
            <AppText variant="caption" weight="600">
              {i.label}
            </AppText>
            <AppText variant="caption" weight="600">
              {formatINR(i.value)}
            </AppText>
          </View>
          <View style={[styles.hbarTrack, { backgroundColor: t.colors.surfaceSunken }]}>
            <View
              style={{
                width: `${(i.value / max) * 100}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: i.color,
              }}
            />
          </View>
          {i.sub ? (
            <AppText variant="caption" muted>
              {i.sub}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  hitRow: { flexDirection: 'row' },
  donutWrap: { alignItems: 'center', gap: 16 },
  donutCenter: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  centerValue: { maxWidth: '100%' },
  legend: { alignSelf: 'stretch', gap: 2 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  pct: { width: 38, textAlign: 'right' },
  hbars: { gap: 14 },
  hbarRow: { gap: 6 },
  hbarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  hbarTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
});
