import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  ClayInput,
  DateField,
  IconBadge,
  SegmentedControl,
  SwitchRow,
} from '@/components/clay';
import { InlineLoader, useConfirm, useToast } from '@/components/feedback';
import type { TransactionType } from '@/db/schema';
import { todayISO } from '@/lib/dates';
import { formatINR, parseRupees } from '@/lib/money';
import { isValid, validateTransaction, type DraftErrors } from '@/lib/validation';
import { useTheme } from '@/theme';

import { useAccounts } from '../accounts/repo';
import { budgetAlertsAfterExpense } from '../budgets/repo';
import { groupCategories, useCategories } from '../categories/repo';
import { useFunds } from '../funds/repo';
import { advanceRuleById, createRuleFromTransaction } from '../recurring/repo';
import { setPref, usePrefs } from '../settings/repo';
import {
  createTransaction,
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
  type TransactionInput,
} from './repo';

export type FormInitial = Partial<TransactionInput> & { type?: TransactionType };

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'investment', label: 'Invest' },
  { value: 'transfer', label: 'Transfer' },
];

function paiseToInput(p?: number | null): string {
  if (!p) return '';
  return p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2);
}

export function TransactionForm({
  initial,
  editId,
  onDone,
  ruleId,
}: {
  initial?: FormInitial;
  /** When set the form edits this transaction. */
  editId?: string;
  /** Logging a due recurring item with a custom amount: advances that reminder. */
  ruleId?: string;
  /** Called after a successful save/delete. */
  onDone?: () => void;
}) {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const prefs = usePrefs();
  const accountsQ = useAccounts();
  const expenseCats = useCategories('expense');
  const incomeCats = useCategories('income');
  const investCats = useCategories('investment');
  const fundsQ = useFunds();

  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense');
  const [amountText, setAmountText] = useState(paiseToInput(initial?.amount));
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(initial?.toAccountId ?? null);
  const [fundId, setFundId] = useState<string | null>(initial?.fundId ?? null);
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? '');
  const [repeat, setRepeat] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const accounts = accountsQ.data;
  const cards = accounts.filter((a) => a.type === 'credit_card');

  // Default account: explicit initial → last used → first non-card account.
  const effectiveAccountId =
    accountId ??
    (accounts.some((a) => a.id === prefs.lastAccountId) ? prefs.lastAccountId : null) ??
    accounts.find((a) => a.type !== 'credit_card')?.id ??
    accounts[0]?.id ??
    null;

  const catList =
    type === 'income'
      ? incomeCats.data
      : type === 'investment'
        ? investCats.data
        : expenseCats.data;
  const groups = useMemo(() => groupCategories(catList), [catList]);
  const selectedCat = catList.find((c) => c.id === categoryId);
  const selectedRootId = selectedCat?.parentId ?? selectedCat?.id ?? null;
  const subcats = groups.find((g) => g.parent.id === selectedRootId)?.children ?? [];

  const amount = parseRupees(amountText);

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    setErrors({});
  };

  const buildInput = (): TransactionInput | null => {
    const investFallback =
      type === 'investment' && !fundId ? (investCats.data[0]?.id ?? null) : categoryId;
    const draft = {
      type,
      amount,
      accountId: effectiveAccountId,
      toAccountId,
      categoryId: type === 'investment' ? investFallback : categoryId,
      fundId,
      date,
    };
    const e = validateTransaction(draft);
    setErrors(e);
    if (!isValid(e)) {
      toast.error('Check the highlighted fields', Object.values(e)[0]);
      return null;
    }
    return {
      ...draft,
      amount: amount!,
      accountId: effectiveAccountId!,
      note,
    };
  };

  const save = () => {
    const input = buildInput();
    if (!input) return;
    setSaving(true);
    try {
      if (editId) {
        updateTransaction(editId, input);
        toast.success('Changes saved', `${formatINR(input.amount)} · ${labelFor(input)}`);
      } else {
        const id = createTransaction(ruleId ? { ...input, recurringRuleId: ruleId } : input);
        if (ruleId) advanceRuleById(ruleId);
        if (repeat) createRuleFromTransaction(input);
        toast.show('success', {
          title: `${TYPE_OPTIONS.find((o) => o.value === type)!.label} added`,
          message: `${formatINR(input.amount)} · ${labelFor(input)}${repeat ? ' · repeats monthly' : ''}`,
          action: { label: 'Undo', onPress: () => deleteTransaction(id) },
        });
        // Reset for the next entry, keep type/account/date.
        setAmountText('');
        setNote('');
        setRepeat(false);
        setCategoryId(null);
      }
      setPref('lastAccountId', input.accountId);
      if (input.type === 'expense') {
        for (const a of budgetAlertsAfterExpense(
          input.categoryId ?? null,
          input.date,
          input.amount,
        )) {
          if (a.tone === 'error') toast.error(a.title, a.message);
          else toast.warning(a.title, a.message);
        }
      }
      onDone?.();
    } catch (e) {
      toast.error("Couldn't save transaction", e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    const ok = await confirm({
      title: 'Delete this transaction?',
      message: `${amount ? formatINR(amount) : ''} on ${date}. Balances and totals will update.`,
      destructive: true,
    });
    if (!ok) return;
    try {
      deleteTransaction(editId);
      toast.show('success', {
        title: 'Transaction deleted',
        action: { label: 'Undo', onPress: () => restoreTransaction(editId) },
      });
      onDone?.();
    } catch (e) {
      toast.error("Couldn't delete transaction", e);
    }
  };

  function labelFor(i: TransactionInput): string {
    if (i.type === 'transfer') {
      const from = accounts.find((a) => a.id === i.accountId)?.name;
      const to = accounts.find((a) => a.id === i.toAccountId)?.name;
      return `${from} → ${to}`;
    }
    if (i.type === 'investment') {
      return fundsQ.data.find((f) => f.id === i.fundId)?.name ?? 'Investment';
    }
    return catList.find((c) => c.id === i.categoryId)?.name ?? '';
  }

  if (accountsQ.loading || expenseCats.loading) return <InlineLoader message="Loading form…" />;

  const typeColor = {
    expense: t.colors.expense,
    income: t.colors.income,
    investment: t.colors.investment,
    transfer: t.colors.transfer,
  }[type];

  const accountLabel =
    type === 'income' ? 'Received in' : type === 'transfer' ? 'From' : 'Paid from';

  return (
    <View style={styles.form}>
      <SegmentedControl
        options={TYPE_OPTIONS}
        value={type}
        onChange={changeType}
        colors={{
          expense: t.colors.expense,
          income: t.colors.income,
          investment: t.colors.investment,
          transfer: t.colors.transfer,
        }}
      />

      {/* Amount */}
      <ClayCard style={styles.amountCard}>
        <AppText variant="label" muted>
          Amount
        </AppText>
        <View style={styles.amountRow}>
          <AppText variant="display" color={typeColor}>
            ₹
          </AppText>
          <TextInput
            value={amountText}
            onChangeText={(v) => {
              setAmountText(v.replace(/[^0-9.,]/g, ''));
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
            placeholder="0"
            placeholderTextColor={t.colors.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount in rupees"
            style={[styles.amountInput, { color: t.colors.text }]}
          />
        </View>
        {errors.amount ? (
          <AppText variant="caption" color={t.colors.danger}>
            {errors.amount}
          </AppText>
        ) : null}
      </ClayCard>

      {/* Category / fund */}
      {type === 'expense' || type === 'income' ? (
        <View style={styles.section}>
          <AppText variant="label" muted>
            Category
          </AppText>
          <View style={styles.grid}>
            {groups.map(({ parent }) => {
              const active = selectedRootId === parent.id;
              return (
                <Pressable
                  key={parent.id}
                  onPress={() => {
                    setCategoryId(parent.id);
                    if (errors.categoryId) setErrors({ ...errors, categoryId: undefined });
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={parent.name}
                  style={[
                    styles.catTile,
                    {
                      backgroundColor: active ? t.colors.primarySoft : t.colors.surface,
                      borderColor: active ? t.colors.primary : t.colors.border,
                    },
                  ]}
                >
                  <IconBadge name={parent.icon} color={parent.color} size={36} />
                  <AppText variant="caption" numberOfLines={1} style={styles.catLabel}>
                    {parent.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {subcats.length > 0 ? (
            <ChipRow>
              {subcats.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  icon={c.icon}
                  color={c.color}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(categoryId === c.id ? selectedRootId : c.id)}
                />
              ))}
            </ChipRow>
          ) : null}
          {errors.categoryId ? (
            <AppText variant="caption" color={t.colors.danger}>
              {errors.categoryId}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {type === 'investment' ? (
        <View style={styles.section}>
          <AppText variant="label" muted>
            Fund
          </AppText>
          <ChipRow>
            {fundsQ.data.map((f) => (
              <Chip
                key={f.id}
                label={f.name}
                icon="trending-up"
                color={t.colors.investment}
                selected={fundId === f.id}
                onPress={() => {
                  setFundId(f.id);
                  if (f.sipAmount && !amountText) setAmountText(paiseToInput(f.sipAmount));
                }}
              />
            ))}
            <Chip label="New fund" icon="add" onPress={() => router.push('/funds/new')} />
          </ChipRow>
          {fundsQ.data.length === 0 ? (
            <AppText variant="caption" muted>
              Add your mutual funds to track how much you invest in each one.
            </AppText>
          ) : null}
          {errors.fundId ? (
            <AppText variant="caption" color={t.colors.danger}>
              {errors.fundId}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Accounts */}
      <View style={styles.section}>
        <AppText variant="label" muted>
          {accountLabel}
        </AppText>
        <ChipRow>
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={a.icon ?? 'wallet'}
              color={a.color ?? undefined}
              selected={effectiveAccountId === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
          <Chip label="New account" icon="add" onPress={() => router.push('/accounts/new')} />
        </ChipRow>
        {errors.accountId ? (
          <AppText variant="caption" color={t.colors.danger}>
            {errors.accountId}
          </AppText>
        ) : null}
      </View>

      {type === 'transfer' ? (
        <View style={styles.section}>
          <AppText variant="label" muted>
            To
          </AppText>
          <ChipRow>
            {accounts
              .filter((a) => a.id !== effectiveAccountId)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  icon={a.icon ?? 'wallet'}
                  color={a.color ?? undefined}
                  selected={toAccountId === a.id}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
          </ChipRow>
          {errors.toAccountId ? (
            <AppText variant="caption" color={t.colors.danger}>
              {errors.toAccountId}
            </AppText>
          ) : null}
          <AppText variant="caption" muted>
            {cards.length > 0
              ? 'Paying a credit card bill? Choose your bank above and the card here. It reduces the card outstanding and is not counted as spending.'
              : 'Transfers move money between your accounts and are not counted as spending.'}
          </AppText>
        </View>
      ) : null}

      <DateField value={date} onChange={setDate} error={errors.date} />
      <ClayInput
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder={type === 'expense' ? 'e.g. Lunch with team' : 'Add a note'}
        maxLength={200}
        returnKeyType="done"
      />

      {!editId ? (
        <ClayCard>
          <SwitchRow
            icon="repeat"
            title="Repeat every month"
            subtitle={`Adds this automatically on day ${Number(date.slice(8, 10))} of each month (salary, SIP, rent, bills).`}
            value={repeat}
            onChange={setRepeat}
          />
        </ClayCard>
      ) : null}

      <ClayButton
        title={editId ? 'Save changes' : 'Save'}
        icon="checkmark"
        size="lg"
        fullWidth
        loading={saving}
        onPress={save}
      />
      {editId ? (
        <ClayButton title="Delete" icon="trash" variant="secondary" fullWidth onPress={remove} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  amountCard: { gap: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '800', paddingVertical: 4 },
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catTile: {
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  catLabel: { textAlign: 'center' },
});
