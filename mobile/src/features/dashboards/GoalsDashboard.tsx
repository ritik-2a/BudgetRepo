import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge, ProgressBar } from '@/components/clay';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback';
import type { Goal } from '@/db/schema';
import { formatDate, formatMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { projectGoal } from '@/lib/projection';
import { useTheme } from '@/theme';

import { useSavingsPace } from '../analytics/queries';
import { useGoals } from '../goals/repo';

export function GoalsDashboard() {
  const { data, loading, error } = useGoals();
  const { pace } = useSavingsPace(3);

  if (error) return <ErrorState title="Couldn't load goals" error={error} />;
  if (loading) return <SkeletonList rows={3} />;
  if (data.length === 0) {
    return (
      <EmptyState
        icon="flag"
        title="No goals yet"
        message="Set a goal (emergency fund, trip, new phone) with a target amount and date, and track how close you are."
        action={{ label: 'Add goal', onPress: () => router.push('/goals/new') }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {data.map((g) => (
        <GoalCard key={g.id} goal={g} pace={pace} />
      ))}
      <AppText variant="caption" muted>
        Projections use your average savings over the last 3 months ({formatINR(Math.max(0, pace))}
        /month), split across all goals.
      </AppText>
      <ClayButton
        title="Add goal"
        icon="add"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/goals/new')}
      />
    </View>
  );
}

function GoalCard({ goal, pace }: { goal: Goal; pace: number }) {
  const t = useTheme();
  const p = projectGoal(goal.targetAmount, goal.savedAmount, goal.targetDate, pace);
  const color = goal.color ?? t.colors.primary;
  const status =
    p.remaining === 0
      ? { text: 'Goal reached', color: t.colors.income }
      : p.onTrack === true
        ? { text: 'On track', color: t.colors.income }
        : p.onTrack === false
          ? { text: 'Behind', color: t.colors.warning }
          : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/goals/[id]', params: { id: goal.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}, ${p.percent} percent saved`}
    >
      <ClayCard style={styles.card}>
        <View style={styles.row}>
          <IconBadge name={goal.icon ?? 'flag'} color={color} size={44} />
          <View style={styles.flex}>
            <AppText variant="subtitle">{goal.name}</AppText>
            <AppText variant="caption" muted>
              {formatINR(goal.savedAmount)} of {formatINR(goal.targetAmount)}
              {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ''}
            </AppText>
          </View>
          <AppText variant="title">{p.percent}%</AppText>
        </View>
        <ProgressBar value={p.percent / 100} color={color} />
        <View style={styles.row}>
          <AppText variant="caption" muted style={styles.flex}>
            {p.remaining === 0
              ? 'Target reached. Well done!'
              : p.requiredPerMonth
                ? `Save ${formatINR(p.requiredPerMonth)}/month to hit the date`
                : p.projectedDate
                  ? `At your pace: around ${formatMonth(p.projectedDate)}`
                  : `${formatINR(p.remaining)} to go`}
          </AppText>
          {status ? (
            <AppText variant="caption" weight="700" color={status.color}>
              {status.text}
            </AppText>
          ) : null}
        </View>
      </ClayCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
