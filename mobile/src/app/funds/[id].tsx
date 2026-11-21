import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ClayInput,
  DateField,
  DayPicker,
  ListCard,
  ListRow,
  Screen,
  SectionTitle,
} from '@/components/clay';
import { EmptyState, useConfirm, useToast } from '@/components/feedback';
import {
  createFund,
  getFund,
  setFundArchived,
  updateFund,
  validateFund,
  type FundInput,
} from '@/features/funds/repo';
import { rescheduleReminders } from '@/features/reminders/notifications';
import { useTransactions } from '@/features/transactions/repo';
import { TxListItem } from '@/features/transactions/TxListItem';
import { formatDate, todayISO } from '@/lib/dates';
import { formatINR, parseRupees } from '@/lib/money';
import { useTheme } from '@/theme';

const toInput = (p?: number | null) =>
  p ? (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2)) : '';

export default function FundEditScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const existing = useMemo(() => (isNew ? undefined : getFund(id)), [isNew, id]);

  const [name, setName] = useState(existing?.name ?? '');
  const [sipAmount, setSipAmount] = useState(toInput(existing?.sipAmount));
  const [sipDay, setSipDay] = useState<number | null>(existing?.sipDay ?? null);
  const [currentValue, setCurrentValue] = useState(toInput(existing?.currentValue));
  const [valueDate, setValueDate] = useState(existing?.currentValueDate ?? todayISO());
  const [errors, setErrors] = useState<Partial<Record<keyof FundInput, string>>>({});

  const txQ = useTransactions({
    start: '0000-01-01',
    end: '9999-12-31',
    type: 'investment',
    fundId: existing?.id ?? '__none__',
  });
  const fundTx = existing ? txQ.data : [];
  const invested = fundTx.reduce((s, x) => s + x.amount, 0);

  if (!isNew && !existing) {
    return (
      <Screen title="Fund" back>
        <EmptyState icon="search" title="Fund not found" />
      </Screen>
    );
  }

  const save = () => {
    const sip = sipAmount.trim() ? parseRupees(sipAmount) : null;
    const cv = currentValue.trim() ? parseRupees(currentValue) : null;
    if ((sipAmount.trim() && sip === null) || (currentValue.trim() && cv === null)) {
      toast.error('Check the amounts', 'Use numbers only, e.g. 5000');
      return;
    }
    const input: FundInput = {
      name,
      sipAmount: sip,
      sipDay,
      currentValue: cv,
      currentValueDate: cv !== null ? valueDate : null,
    };
    const e = validateFund(input);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Check the highlighted fields', Object.values(e)[0]);
      return;
    }
    try {
      if (existing) updateFund(existing.id, input);
      else createFund(input);
      toast.success(existing ? 'Fund updated' : 'Fund added', input.name.trim());
      rescheduleReminders().catch(() => {});
      router.back();
    } catch (err) {
      toast.error("Couldn't save fund", err);
    }
  };

  const archive = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: existing.archived ? `Restore ${existing.name}?` : `Archive ${existing.name}?`,
      message: existing.archived
        ? 'It will show in pickers again.'
        : 'Use this after you redeem a fund. Past investments stay in your totals.',
      confirmLabel: existing.archived ? 'Restore' : 'Archive',
    });
    if (!ok) return;
    setFundArchived(existing.id, !existing.archived);
    toast.success(existing.archived ? 'Fund restored' : 'Fund archived');
    rescheduleReminders().catch(() => {});
    router.back();
  };

  const gain = existing?.currentValue != null ? existing.currentValue - invested : null;

  return (
    <Screen title={existing ? existing.name : 'Add fund'} back>
      {existing ? (
        <ClayCard style={styles.summary}>
          <AppText variant="label" muted>
            Total invested
          </AppText>
          <AppText variant="display" color={t.colors.investment}>
            {formatINR(invested)}
          </AppText>
          {gain !== null ? (
            <AppText variant="caption" color={gain >= 0 ? t.colors.income : t.colors.danger}>
              Value {formatINR(existing.currentValue!)} · {formatINR(gain, { signed: true })} (
              {invested > 0 ? ((gain / invested) * 100).toFixed(1) : '0'}%) as of{' '}
              {formatDate(existing.currentValueDate ?? todayISO())}
            </AppText>
          ) : (
            <AppText variant="caption" muted>
              Add a current value below to see your gain or loss.
            </AppText>
          )}
          <ClayButton
            title="Log investment"
            icon="add"
            onPress={() =>
              router.navigate({
                pathname: '/add',
                params: {
                  type: 'investment',
                  fundId: existing.id,
                  amount: existing.sipAmount ? String(existing.sipAmount) : undefined,
                },
              })
            }
          />
        </ClayCard>
      ) : null}

      <ClayInput
        label="Fund name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Parag Parikh Flexi Cap"
        error={errors.name}
        maxLength={60}
      />
      <ClayInput
        label="Monthly SIP amount (optional)"
        value={sipAmount}
        onChangeText={setSipAmount}
        placeholder="e.g. 5000"
        keyboardType="decimal-pad"
        prefix="₹"
        error={errors.sipAmount}
      />
      <DayPicker
        label="SIP date (optional)"
        value={sipDay}
        onChange={setSipDay}
        error={errors.sipDay}
      />
      <AppText variant="caption" muted>
        With a SIP date you get a reminder on that day each month.
      </AppText>

      <ClayCard style={styles.section}>
        <AppText variant="subtitle">Current value (optional)</AppText>
        <AppText variant="caption" muted>
          Check your fund app now and then and enter the value here to see gain/loss. No daily
          tracking needed.
        </AppText>
        <ClayInput
          value={currentValue}
          onChangeText={setCurrentValue}
          placeholder="e.g. 125000"
          keyboardType="decimal-pad"
          prefix="₹"
        />
        {currentValue.trim() ? (
          <DateField label="Value as of" value={valueDate} onChange={setValueDate} />
        ) : null}
      </ClayCard>

      <ClayButton title="Save" icon="checkmark" size="lg" fullWidth onPress={save} />
      {existing ? (
        <ClayButton
          title={existing.archived ? 'Restore fund' : 'Archive fund'}
          icon="archive"
          variant="secondary"
          fullWidth
          onPress={archive}
        />
      ) : null}

      {existing && fundTx.length > 0 ? (
        <>
          <SectionTitle title="Investments" />
          <ListCard>
            {fundTx.slice(0, 24).map((x) => (
              <TxListItem key={x.id} tx={x} showDate />
            ))}
          </ListCard>
        </>
      ) : null}
      {existing && fundTx.length === 0 && !txQ.loading ? (
        <ListCard>
          <ListRow icon="information-circle" title="No investments logged yet" chevron={false} />
        </ListCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 6, alignItems: 'flex-start' },
  section: { gap: 10 },
});
