import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ClayInput,
  IconBadge,
  ListCard,
  MonthSwitcher,
  Screen,
  SectionTitle,
} from '@/components/clay';
import { Banner, ErrorState, SkeletonList, useConfirm, useToast } from '@/components/feedback';
import {
  copyBudgetsFromPreviousMonth,
  deleteBudget,
  setBudget,
  useBudgetStatus,
  type BudgetLine,
} from '@/features/budgets/repo';
import { groupCategories, useCategories } from '@/features/categories/repo';
import { BudgetMini } from '@/features/dashboards/OverviewDashboard';
import { formatMonth, toMonthKey } from '@/lib/dates';
import { formatINR, parseRupees } from '@/lib/money';
import { useTheme } from '@/theme';

type Editing = { categoryId: string | null; name: string; current: number | null; id?: string };

export default function BudgetsScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [month, setMonth] = useState(() => new Date());
  const status = useBudgetStatus(month);
  const cats = useCategories('expense');
  const roots = groupCategories(cats.data).map((g) => g.parent);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [amount, setAmount] = useState('');

  const budgeted = new Map(status.data.lines.map((l) => [l.budget.categoryId, l]));
  const unbudgeted = roots.filter((r) => !budgeted.has(r.id));
  const key = toMonthKey(month);

  const openEditor = (e: Editing) => {
    setEditing(e);
    setAmount(e.current ? String(e.current / 100) : '');
  };

  const saveEditor = () => {
    if (!editing) return;
    const p = parseRupees(amount);
    if (!p) {
      toast.error('Enter a budget amount', 'Use numbers only, e.g. 8000');
      return;
    }
    try {
      setBudget(key, editing.categoryId, p);
      toast.success('Budget saved', `${editing.name}: ${formatINR(p)} for ${formatMonth(month)}`);
      setEditing(null);
    } catch (err) {
      toast.error("Couldn't save budget", err);
    }
  };

  const removeEditor = async () => {
    if (!editing?.id) return;
    const ok = await confirm({
      title: `Remove ${editing.name} budget?`,
      destructive: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    deleteBudget(editing.id);
    toast.success('Budget removed');
    setEditing(null);
  };

  const copy = () => {
    const n = copyBudgetsFromPreviousMonth(month);
    if (n > 0) toast.success(`Copied ${n} budget${n === 1 ? '' : 's'}`, 'From last month');
    else toast.info('Nothing to copy', 'Last month has no budgets that are missing here.');
  };

  const lineRow = (l: BudgetLine) => (
    <Pressable
      key={l.budget.id}
      onPress={() =>
        openEditor({
          categoryId: l.budget.categoryId,
          name: l.category?.name ?? 'Overall',
          current: l.budget.limitAmount,
          id: l.budget.id,
        })
      }
      accessibilityRole="button"
      accessibilityHint="Edit budget"
    >
      <BudgetMini
        name={l.category?.name ?? 'Overall monthly'}
        spent={l.spent}
        limit={l.budget.limitAmount}
        ratio={l.ratio}
      />
    </Pressable>
  );

  const nothingSet = !status.data.overall && status.data.lines.length === 0;

  return (
    <Screen title="Budgets" back>
      <MonthSwitcher month={month} onChange={setMonth} />
      {status.error ? <ErrorState title="Couldn't load budgets" error={status.error} /> : null}
      {status.loading ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          {nothingSet ? (
            <Banner
              tone="info"
              title="No budgets for this month"
              message="Set an overall limit and limits for categories you want to control. You'll get an alert at 80% and when you go over."
            />
          ) : null}

          <SectionTitle title="Overall" />
          <ListCard>
            {status.data.overall ? (
              lineRow(status.data.overall)
            ) : (
              <ClayButton
                title="Set overall monthly budget"
                icon="add"
                variant="secondary"
                fullWidth
                onPress={() => openEditor({ categoryId: null, name: 'Overall', current: null })}
              />
            )}
          </ListCard>

          {status.data.lines.length > 0 ? (
            <>
              <SectionTitle title="Categories" />
              <ListCard>{status.data.lines.map(lineRow)}</ListCard>
            </>
          ) : null}

          {unbudgeted.length > 0 ? (
            <>
              <SectionTitle title="Add a category budget" />
              <View style={styles.grid}>
                {unbudgeted.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => openEditor({ categoryId: c.id, name: c.name, current: null })}
                    accessibilityRole="button"
                    accessibilityLabel={`Set budget for ${c.name}`}
                    android_ripple={{ color: t.colors.ripple }}
                    style={[
                      styles.tile,
                      { backgroundColor: t.colors.surface, borderColor: t.colors.border },
                    ]}
                  >
                    <IconBadge name={c.icon} color={c.color} size={32} />
                    <View style={styles.flex}>
                      <AppText variant="caption" weight="600" numberOfLines={1}>
                        {c.name}
                      </AppText>
                      <AppText variant="caption" muted numberOfLines={1}>
                        {formatINR(status.data.spendByRoot.get(c.id) ?? 0)} spent
                      </AppText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <ClayButton
            title="Copy last month's budgets"
            icon="copy"
            variant="secondary"
            fullWidth
            onPress={copy}
          />
        </>
      )}

      <Modal
        visible={!!editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable onPress={() => {}}>
            <ClayCard style={styles.sheet}>
              <AppText variant="title">{editing?.name} budget</AppText>
              <AppText variant="caption" muted>
                {formatMonth(month)}
              </AppText>
              <ClayInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Monthly limit"
                keyboardType="decimal-pad"
                prefix="₹"
              />
              <View style={styles.buttons}>
                {editing?.id ? (
                  <ClayButton title="Remove" variant="secondary" onPress={removeEditor} />
                ) : null}
                <View style={styles.flex} />
                <ClayButton title="Cancel" variant="secondary" onPress={() => setEditing(null)} />
                <ClayButton title="Save" onPress={saveEditor} />
              </View>
            </ClayCard>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 25, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { gap: 12 },
  buttons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
