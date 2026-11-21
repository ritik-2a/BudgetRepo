import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  ClayInput,
  DayPicker,
  Screen,
} from '@/components/clay';
import { Banner, EmptyState, useConfirm, useToast } from '@/components/feedback';
import { ACCOUNT_TYPES, type AccountType } from '@/db/schema';
import {
  ACCOUNT_TYPE_META,
  countAccountTransactions,
  createAccount,
  getAccount,
  setAccountArchived,
  updateAccount,
  validateAccount,
  type AccountInput,
} from '@/features/accounts/repo';
import { CATEGORY_COLORS } from '@/features/categories/repo';
import { rescheduleReminders } from '@/features/reminders/notifications';
import { formatINR, parseRupees } from '@/lib/money';
import { useTheme } from '@/theme';

const toInput = (p?: number | null) =>
  p ? (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2)) : '';

export default function AccountEditScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const isNew = params.id === 'new';
  const existing = useMemo(() => (isNew ? undefined : getAccount(params.id)), [isNew, params.id]);

  const initialType: AccountType =
    existing?.type ??
    (ACCOUNT_TYPES.includes(params.type as AccountType) ? (params.type as AccountType) : 'bank');

  const [type, setType] = useState<AccountType>(initialType);
  const [name, setName] = useState(existing?.name ?? '');
  const [opening, setOpening] = useState(toInput(existing?.openingBalance));
  const [limit, setLimit] = useState(toInput(existing?.creditLimit));
  const [statementDay, setStatementDay] = useState<number | null>(existing?.statementDay ?? null);
  const [dueDay, setDueDay] = useState<number | null>(existing?.dueDay ?? null);
  const [color, setColor] = useState<string | null>(existing?.color ?? null);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountInput, string>>>({});

  if (!isNew && !existing) {
    return (
      <Screen title="Account" back>
        <EmptyState icon="search" title="Account not found" message="It may have been removed." />
      </Screen>
    );
  }

  const isCard = type === 'credit_card';
  const meta = ACCOUNT_TYPE_META[type];

  const save = () => {
    const openingPaise = opening.trim() ? parseRupees(opening.replace('-', '')) : 0;
    const limitPaise = limit.trim() ? parseRupees(limit) : null;
    if (openingPaise === null) {
      setErrors({ openingBalance: 'Enter a valid amount' });
      return;
    }
    const input: AccountInput = {
      name,
      type,
      openingBalance: opening.trim().startsWith('-') ? -openingPaise : openingPaise,
      creditLimit: isCard ? limitPaise : null,
      statementDay: isCard ? statementDay : null,
      dueDay: isCard ? dueDay : null,
      icon: meta.icon,
      color: color ?? meta.color,
    };
    const e = validateAccount(input);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Check the highlighted fields', Object.values(e)[0]);
      return;
    }
    try {
      if (existing) updateAccount(existing.id, input);
      else createAccount(input);
      toast.success(existing ? 'Account updated' : 'Account added', input.name);
      if (isCard) rescheduleReminders().catch(() => {});
      router.back();
    } catch (err) {
      toast.error("Couldn't save account", err);
    }
  };

  const toggleArchive = async () => {
    if (!existing) return;
    if (!existing.archived) {
      const n = countAccountTransactions(existing.id);
      const ok = await confirm({
        title: `Archive ${existing.name}?`,
        message: `It will be hidden from pickers. ${n} past transaction${n === 1 ? '' : 's'} stay in your history and totals.`,
        confirmLabel: 'Archive',
      });
      if (!ok) return;
    }
    setAccountArchived(existing.id, !existing.archived);
    toast.success(existing.archived ? 'Account restored' : 'Account archived', existing.name);
    if (existing.type === 'credit_card') rescheduleReminders().catch(() => {});
    router.back();
  };

  return (
    <Screen title={existing ? 'Edit account' : isCard ? 'Add credit card' : 'Add account'} back>
      {!existing ? (
        <View style={styles.section}>
          <AppText variant="label" muted>
            Type
          </AppText>
          <ChipRow>
            {ACCOUNT_TYPES.map((ty) => (
              <Chip
                key={ty}
                label={ACCOUNT_TYPE_META[ty].label}
                icon={ACCOUNT_TYPE_META[ty].icon}
                color={ACCOUNT_TYPE_META[ty].color}
                selected={type === ty}
                onPress={() => setType(ty)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <ClayInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={isCard ? 'e.g. HDFC Millennia' : 'e.g. SBI Salary'}
        error={errors.name}
        maxLength={40}
      />

      <ClayInput
        label={isCard ? 'Outstanding right now (₹)' : 'Current balance (₹)'}
        value={opening}
        onChangeText={setOpening}
        placeholder="0"
        keyboardType="numbers-and-punctuation"
        prefix="₹"
        error={errors.openingBalance}
      />
      <AppText variant="caption" muted style={styles.hint}>
        {isCard
          ? 'What you owe on this card before you start tracking. Purchases add to it; bill payments (transfers to the card) reduce it.'
          : 'Balance before you start tracking. Use a minus sign for an overdraft.'}
      </AppText>

      {isCard ? (
        <ClayCard style={styles.section}>
          <AppText variant="subtitle">Billing cycle</AppText>
          <ClayInput
            label="Credit limit (optional)"
            value={limit}
            onChangeText={setLimit}
            placeholder="e.g. 150000"
            keyboardType="decimal-pad"
            prefix="₹"
          />
          <DayPicker
            label="Statement day"
            value={statementDay}
            onChange={setStatementDay}
            error={errors.statementDay}
          />
          <DayPicker
            label="Payment due day"
            value={dueDay}
            onChange={setDueDay}
            error={errors.dueDay}
          />
          {statementDay && dueDay ? (
            <Banner
              tone="info"
              message={`Purchases from day ${(statementDay % 31) + 1} to day ${statementDay} go on one bill, due on day ${dueDay}${dueDay > statementDay ? ' of the same month' : ' of the next month'}.`}
            />
          ) : null}
        </ClayCard>
      ) : null}

      <View style={styles.section}>
        <AppText variant="label" muted>
          Colour
        </AppText>
        <View style={styles.colors}>
          {CATEGORY_COLORS.map((c) => (
            <ClayButton
              key={c}
              accessibilityLabel={`Colour ${c}`}
              variant="secondary"
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderWidth: (color ?? meta.color) === c ? 3 : 0,
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
          title={existing.archived ? 'Restore account' : 'Archive account'}
          icon={existing.archived ? 'refresh' : 'archive'}
          variant="secondary"
          fullWidth
          onPress={toggleArchive}
        />
      ) : null}
      {existing && existing.openingBalance !== 0 ? (
        <AppText variant="caption" muted style={styles.hint}>
          Starting balance: {formatINR(existing.openingBalance)}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  hint: { marginTop: -8 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 12 },
});
