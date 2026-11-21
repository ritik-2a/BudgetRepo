import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DonutChart } from '@/components/charts';
import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  ProgressBar,
  SectionTitle,
} from '@/components/clay';
import { Banner, EmptyState, ErrorState, SkeletonList } from '@/components/feedback';
import { getCardCycle } from '@/lib/billing-cycle';
import { formatDate, todayISO } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useAccountBalances, type AccountWithBalance } from '../accounts/repo';
import { useCardActivity, useSpendByCategory } from '../analytics/queries';

export function CardDashboard() {
  const { data, loading, error } = useAccountBalances();
  const cards = data.filter((a) => a.type === 'credit_card');
  const [selected, setSelected] = useState<string | null>(null);
  const card = cards.find((c) => c.id === selected) ?? cards[0];

  if (error) return <ErrorState title="Couldn't load cards" error={error} />;
  if (loading) return <SkeletonList rows={3} />;
  if (!card) {
    return (
      <EmptyState
        icon="card"
        title="No credit cards yet"
        message="Add your card with its statement day and due day to track each billing cycle, see what you owe and get reminders before the due date."
        action={{
          label: 'Add credit card',
          onPress: () =>
            router.push({ pathname: '/accounts/[id]', params: { id: 'new', type: 'credit_card' } }),
        }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {cards.length > 1 ? (
        <ChipRow>
          {cards.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon="card"
              color={c.color ?? undefined}
              selected={c.id === card.id}
              onPress={() => setSelected(c.id)}
            />
          ))}
        </ChipRow>
      ) : null}
      {card.statementDay && card.dueDay ? (
        <CardDetail key={card.id} card={card} />
      ) : (
        <Banner
          tone="warning"
          title="Billing dates missing"
          message={`Set the statement and due day for ${card.name} to see billing cycles.`}
        />
      )}
      {!card.statementDay || !card.dueDay ? (
        <ClayButton
          title="Edit card"
          icon="create"
          variant="secondary"
          onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: card.id } })}
        />
      ) : null}
    </View>
  );
}

function CardDetail({ card }: { card: AccountWithBalance }) {
  const t = useTheme();
  const cycle = getCardCycle(card.statementDay!, card.dueDay!);
  const act = useCardActivity(card.id, cycle.lastStart, cycle.lastEnd);
  const cats = useSpendByCategory(cycle.currentStart, todayISO(), card.id);
  const a = act.data[0];

  const statement = a ? Math.max(0, a.statementSpend - a.statementRefunds) : 0;
  const paid = a?.paidSinceStatement ?? 0;
  const dueRemaining = Math.max(0, statement - paid);
  const outstanding = Math.max(0, card.outstanding);
  const util = card.creditLimit ? outstanding / card.creditLimit : null;

  const dueTone =
    dueRemaining === 0
      ? { color: t.colors.income, text: statement > 0 ? 'Bill paid' : 'Nothing due' }
      : cycle.daysToDue < 0
        ? { color: t.colors.danger, text: `Overdue by ${-cycle.daysToDue} days` }
        : cycle.daysToDue === 0
          ? { color: t.colors.danger, text: 'Due today' }
          : cycle.daysToDue <= 5
            ? { color: t.colors.warning, text: `Due in ${cycle.daysToDue} days` }
            : { color: t.colors.text, text: `Due in ${cycle.daysToDue} days` };

  return (
    <View style={styles.wrap}>
      <ClayCard tint={card.color ?? t.colors.creditCard} style={styles.hero}>
        <AppText variant="label" color="#FFFFFF" style={styles.dim}>
          {card.name} · outstanding
        </AppText>
        <AppText variant="display" color="#FFFFFF">
          {formatINR(outstanding)}
        </AppText>
        {util !== null ? (
          <>
            <ProgressBar value={util} color="#FFFFFF" height={8} />
            <AppText variant="caption" color="#FFFFFF" style={styles.dim}>
              {Math.round(util * 100)}% of {formatINR(card.creditLimit!)} limit used
            </AppText>
          </>
        ) : null}
      </ClayCard>

      <ClayCard style={styles.gap}>
        <View style={styles.row}>
          <AppText variant="subtitle">Last statement</AppText>
          <AppText variant="subtitle" color={dueTone.color}>
            {dueTone.text}
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {formatDate(cycle.lastStart)} – {formatDate(cycle.lastEnd)} · due{' '}
          {formatDate(cycle.dueDate)}
        </AppText>
        <View style={styles.cols}>
          <Mini label="Bill amount" value={statement} />
          <Mini label="Paid" value={paid} color={t.colors.income} />
          <Mini
            label="Left to pay"
            value={dueRemaining}
            color={dueRemaining ? dueTone.color : undefined}
          />
        </View>
        {dueRemaining > 0 ? (
          <ClayButton
            title={`Pay ${formatINR(dueRemaining)}`}
            icon="checkmark-done"
            fullWidth
            onPress={() =>
              router.navigate({
                pathname: '/add',
                params: { type: 'transfer', toAccountId: card.id, amount: String(dueRemaining) },
              })
            }
          />
        ) : null}
      </ClayCard>

      <ClayCard style={styles.gap}>
        <View style={styles.row}>
          <AppText variant="subtitle">Current cycle</AppText>
          <AppText variant="subtitle">{formatINR(a?.currentSpend ?? 0)}</AppText>
        </View>
        <AppText variant="caption" muted>
          {formatDate(cycle.currentStart)} – {formatDate(cycle.currentEnd)} · goes on the bill due{' '}
          {formatDate(cycle.nextDueDate)}
        </AppText>
      </ClayCard>

      <SectionTitle title="This cycle by category" />
      <ClayCard>
        {cats.data.length === 0 ? (
          <AppText variant="caption" muted>
            No card purchases in this cycle yet.
          </AppText>
        ) : (
          <DonutChart
            centerLabel="This cycle"
            size={170}
            segments={cats.data.map((c) => ({
              key: c.id,
              label: c.name,
              value: c.total,
              color: c.color,
            }))}
          />
        )}
      </ClayCard>
      <Banner
        tone="info"
        message="Paying the bill? Log it as a Transfer from your bank to this card. It lowers the outstanding without counting as spending twice."
      />
    </View>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.mini}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="subtitle" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {formatINR(value)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  hero: { gap: 8, paddingVertical: 22 },
  dim: { opacity: 0.92 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cols: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, gap: 2 },
});
