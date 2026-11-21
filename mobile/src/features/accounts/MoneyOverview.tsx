import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge } from '@/components/clay';
import { Skeleton } from '@/components/feedback';
import { daysBetween, formatDate, fromISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useRules } from '../recurring/repo';
import { useCardDues, type CardWithDues } from './cardDues';

const shortDate = (iso: string) => formatDate(iso).replace(/ \d{4}$/, '');

/** "Salary expected in 15 days" (no amount shown on Home). */
function incomeEta(nextRunIso: string): string {
  const days = daysBetween(new Date(), fromISODate(nextRunIso));
  if (days <= 0) return 'Salary expected today';
  if (days === 1) return 'Salary expected tomorrow';
  return `Salary expected in ${days} days`;
}

/**
 * Home's top section: real money in the bank, each credit card split into the bill to pay
 * now and the next bill building up, and what's left after paying the bill(s).
 */
export function MoneyOverview() {
  const t = useTheme();
  const { data: cards, loading, balances } = useCardDues();
  const nextIncome = useRules()
    .data.filter((r) => r.enabled && r.template.type === 'income')
    .sort((a, b) => a.nextRun.localeCompare(b.nextRun))[0];

  const bankAccounts = balances.filter(
    (a) => a.type === 'bank' || a.type === 'wallet' || a.type === 'cash',
  );
  const inBank = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const hasCashOrUpi = bankAccounts.some((a) => a.type !== 'bank' && a.balance !== 0);
  const billsToPay = cards.reduce((s, c) => s + c.dues.billToPay, 0);
  const afterBills = inBank - billsToPay;

  if (loading) {
    return (
      <ClayCard style={styles.hero}>
        <Skeleton width="40%" height={12} />
        <Skeleton width="60%" height={32} />
        <Skeleton width="80%" height={12} />
      </ClayCard>
    );
  }

  return (
    <>
      <Pressable onPress={() => router.push('/accounts')} accessibilityRole="button">
        <ClayCard tint={t.colors.hero} style={styles.hero}>
          <AppText variant="label" color={t.colors.onHeroMuted}>
            {hasCashOrUpi ? 'Bank & cash' : 'Money in bank'}
          </AppText>
          <AppText variant="display" color={t.colors.onHero}>
            {formatINR(inBank)}
          </AppText>
          <AppText variant="caption" color={t.colors.onHeroMuted} numberOfLines={2}>
            {bankAccounts
              .filter((a) => a.balance !== 0)
              .map((a) => `${a.name} ${formatINR(a.balance)}`)
              .join(' · ') || 'Add your bank balance in Accounts'}
          </AppText>
          {billsToPay > 0 ? (
            <View style={[styles.after, { borderTopColor: t.colors.heroTrack }]}>
              <View style={styles.flex}>
                <AppText variant="caption" color={t.colors.onHeroMuted}>
                  After paying card bill
                  {cards.filter((c) => c.dues.billToPay > 0).length > 1 ? 's' : ''}
                </AppText>
                {afterBills < 0 && nextIncome ? (
                  <AppText variant="caption" color={t.colors.onHeroMuted}>
                    {incomeEta(nextIncome.nextRun)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="title" color={afterBills < 0 ? '#FFB4A8' : t.colors.onHero}>
                {afterBills < 0 ? '−' : ''}
                {formatINR(Math.abs(afterBills))}
              </AppText>
            </View>
          ) : null}
        </ClayCard>
      </Pressable>

      {cards.map((c) => (
        <CardDuesCard key={c.card.id} item={c} />
      ))}
    </>
  );
}

function CardDuesCard({ item }: { item: CardWithDues }) {
  const t = useTheme();
  const { card, dues } = item;
  const total = Math.max(0, card.outstanding);
  const dueColor =
    dues.billToPay === 0
      ? t.colors.income
      : dues.daysToDue < 0
        ? t.colors.danger
        : dues.daysToDue <= 5
          ? t.colors.warning
          : t.colors.textMuted;
  const dueText =
    dues.billToPay === 0
      ? 'Paid'
      : dues.daysToDue < 0
        ? `Overdue by ${-dues.daysToDue} days`
        : dues.daysToDue === 0
          ? 'Due today'
          : `Due ${shortDate(dues.dueDate)} · ${dues.daysToDue} days`;

  return (
    <ClayCard style={styles.cardBox}>
      <Pressable
        onPress={() => router.navigate({ pathname: '/insights', params: { tab: 'card' } })}
        accessibilityRole="button"
        style={styles.row}
      >
        <IconBadge name="card" color={card.color ?? t.colors.creditCard} size={38} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{card.name}</AppText>
          <AppText variant="caption" muted>
            Total owed {formatINR(total)}
          </AppText>
        </View>
      </Pressable>

      <View style={styles.split}>
        <View
          style={[
            styles.cell,
            { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radius.md },
          ]}
        >
          <AppText variant="caption" muted>
            Bill to pay
          </AppText>
          <AppText variant="title">{formatINR(dues.billToPay)}</AppText>
          <AppText variant="caption" color={dueColor} weight="600">
            {dueText}
          </AppText>
        </View>
        <View
          style={[
            styles.cell,
            { backgroundColor: t.colors.surfaceSunken, borderRadius: t.radius.md },
          ]}
        >
          <AppText variant="caption" muted>
            Next bill so far
          </AppText>
          <AppText variant="title">{formatINR(dues.nextBillSoFar)}</AppText>
          <AppText variant="caption" muted>
            Generates {shortDate(dues.nextStatementDate)}
          </AppText>
        </View>
      </View>

      {dues.billToPay > 0 ? (
        <ClayButton
          title={`Pay ${formatINR(dues.billToPay)}`}
          icon="checkmark-done"
          variant="secondary"
          fullWidth
          onPress={() =>
            router.navigate({
              pathname: '/add',
              params: {
                type: 'transfer',
                toAccountId: card.id,
                amount: String(dues.billToPay),
              },
            })
          }
        />
      ) : null}
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6, paddingTop: 22, paddingBottom: 18 },
  after: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  flex: { flex: 1, gap: 2 },
  cardBox: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  split: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, padding: 12, gap: 2 },
});
