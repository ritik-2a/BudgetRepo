import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText, ClayCard, IconBadge } from './clay';

export function ComingSoon({
  icon,
  title,
  phase,
  items,
}: {
  icon: string;
  title: string;
  phase: string;
  items: string[];
}) {
  const t = useTheme();
  return (
    <ClayCard style={styles.card}>
      <View style={styles.row}>
        <IconBadge name={icon} color={t.colors.primary} size={48} />
        <View style={styles.text}>
          <AppText variant="subtitle">{title}</AppText>
          <AppText variant="caption" muted>
            Coming in {phase}
          </AppText>
        </View>
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <AppText key={item} variant="caption" muted>
            • {item}
          </AppText>
        ))}
      </View>
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1, gap: 2 },
  list: { gap: 4 },
});
