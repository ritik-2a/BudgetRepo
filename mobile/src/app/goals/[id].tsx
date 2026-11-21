import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ClayInput,
  DateField,
  IconBadge,
  ProgressBar,
  Screen,
  SwitchRow,
} from '@/components/clay';
import { EmptyState, useConfirm, useToast } from '@/components/feedback';
import { CATEGORY_COLORS } from '@/features/categories/repo';
import {
  GOAL_ICONS,
  contributeToGoal,
  createGoal,
  deleteGoal,
  getGoal,
  updateGoal,
  validateGoal,
  type GoalInput,
} from '@/features/goals/repo';
import { addMonths, toISODate } from '@/lib/dates';
import { formatINR, parseRupees } from '@/lib/money';
import { useTheme } from '@/theme';

const toInput = (p?: number | null) =>
  p ? (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2)) : '';

export default function GoalEditScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const existing = useMemo(() => (isNew ? undefined : getGoal(id)), [isNew, id, version]);

  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(toInput(existing?.targetAmount));
  const [saved, setSaved] = useState(toInput(existing?.savedAmount));
  const [hasDate, setHasDate] = useState(!!existing?.targetDate || isNew);
  const [date, setDate] = useState(existing?.targetDate ?? toISODate(addMonths(new Date(), 12)));
  const [icon, setIcon] = useState(existing?.icon ?? 'flag');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[2]);
  const [contribution, setContribution] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof GoalInput, string>>>({});

  if (!isNew && !existing) {
    return (
      <Screen title="Goal" back>
        <EmptyState icon="search" title="Goal not found" />
      </Screen>
    );
  }

  const save = () => {
    const input: GoalInput = {
      name,
      targetAmount: parseRupees(target) ?? 0,
      savedAmount: saved.trim() ? (parseRupees(saved) ?? -1) : 0,
      targetDate: hasDate ? date : null,
      icon,
      color,
    };
    const e = validateGoal(input);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Check the highlighted fields', Object.values(e)[0]);
      return;
    }
    try {
      if (existing) updateGoal(existing.id, input);
      else createGoal(input);
      toast.success(existing ? 'Goal updated' : 'Goal created', input.name.trim());
      router.back();
    } catch (err) {
      toast.error("Couldn't save goal", err);
    }
  };

  const contribute = (sign: 1 | -1) => {
    if (!existing) return;
    const amt = parseRupees(contribution);
    if (!amt) {
      toast.error('Enter an amount first');
      return;
    }
    try {
      const now = contributeToGoal(existing.id, sign * amt);
      setSaved(toInput(now));
      setContribution('');
      setVersion((v) => v + 1);
      if (
        sign > 0 &&
        now >= existing.targetAmount &&
        existing.savedAmount < existing.targetAmount
      ) {
        toast.success('Goal reached! 🎉', `${existing.name}: ${formatINR(now)} saved`);
      } else {
        toast.success(sign > 0 ? 'Money added' : 'Money withdrawn', `Now ${formatINR(now)} saved`);
      }
    } catch (err) {
      toast.error("Couldn't update goal", err);
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Delete ${existing.name}?`,
      message: 'This removes the goal and its progress.',
      destructive: true,
    });
    if (!ok) return;
    deleteGoal(existing.id);
    toast.success('Goal deleted');
    router.back();
  };

  const pct =
    existing && existing.targetAmount > 0 ? existing.savedAmount / existing.targetAmount : 0;

  return (
    <Screen title={existing ? existing.name : 'New goal'} back>
      {existing ? (
        <ClayCard style={styles.gap}>
          <View style={styles.row}>
            <IconBadge
              name={existing.icon ?? 'flag'}
              color={existing.color ?? t.colors.primary}
              size={48}
            />
            <View style={styles.flex}>
              <AppText variant="title">{formatINR(existing.savedAmount)}</AppText>
              <AppText variant="caption" muted>
                of {formatINR(existing.targetAmount)} · {Math.min(100, Math.round(pct * 100))}%
              </AppText>
            </View>
          </View>
          <ProgressBar value={pct} color={existing.color ?? t.colors.primary} />
          <ClayInput
            label="Add or withdraw money"
            value={contribution}
            onChangeText={setContribution}
            placeholder="Amount"
            keyboardType="decimal-pad"
            prefix="₹"
          />
          <View style={styles.row}>
            <ClayButton title="Add" icon="add" onPress={() => contribute(1)} style={styles.flex} />
            <ClayButton
              title="Withdraw"
              icon="remove"
              variant="secondary"
              onPress={() => contribute(-1)}
              style={styles.flex}
            />
          </View>
        </ClayCard>
      ) : null}

      <ClayInput
        label="Goal name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Emergency fund"
        error={errors.name}
        maxLength={40}
      />
      <ClayInput
        label="Target amount"
        value={target}
        onChangeText={setTarget}
        placeholder="e.g. 300000"
        keyboardType="decimal-pad"
        prefix="₹"
        error={errors.targetAmount}
      />
      {!existing ? (
        <ClayInput
          label="Already saved (optional)"
          value={saved}
          onChangeText={setSaved}
          placeholder="0"
          keyboardType="decimal-pad"
          prefix="₹"
          error={errors.savedAmount}
        />
      ) : null}
      <ClayCard style={styles.gap}>
        <SwitchRow title="Target date" value={hasDate} onChange={setHasDate} />
        {hasDate ? (
          <DateField label="Reach it by" value={date} onChange={setDate} allowFuture />
        ) : null}
      </ClayCard>

      <View style={styles.gap}>
        <AppText variant="label" muted>
          Icon & colour
        </AppText>
        <View style={styles.grid}>
          {GOAL_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              accessibilityRole="button"
              accessibilityLabel={`Icon ${i}`}
              style={[styles.cell, { borderColor: icon === i ? color : 'transparent' }]}
            >
              <IconBadge name={i} color={icon === i ? color : t.colors.textMuted} size={34} />
            </Pressable>
          ))}
        </View>
        <View style={styles.grid}>
          {CATEGORY_COLORS.slice(0, 12).map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: t.colors.text,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ClayButton title="Save" icon="checkmark" size="lg" fullWidth onPress={save} />
      {existing ? (
        <ClayButton
          title="Delete goal"
          icon="trash"
          variant="secondary"
          fullWidth
          onPress={remove}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, alignSelf: 'auto' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { padding: 3, borderRadius: 16, borderWidth: 2 },
  swatch: { width: 36, height: 36, borderRadius: 12 },
});
