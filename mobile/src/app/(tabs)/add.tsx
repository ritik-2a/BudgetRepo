import { router, useLocalSearchParams } from 'expo-router';

import { AppText, Screen } from '@/components/clay';
import type { TransactionType } from '@/db/schema';
import { QuickTravel } from '@/features/transactions/QuickTravel';
import { TransactionForm } from '@/features/transactions/TransactionForm';

const TYPES: TransactionType[] = ['expense', 'income', 'investment', 'transfer'];

export default function AddScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    categoryId?: string;
    amount?: string;
    fundId?: string;
    toAccountId?: string;
    accountId?: string;
    ruleId?: string;
    note?: string;
  }>();
  const type = TYPES.includes(params.type as TransactionType)
    ? (params.type as TransactionType)
    : undefined;
  const amount = params.amount ? Number(params.amount) : undefined;

  return (
    <Screen title="Add" subtitle="New transaction">
      <AppText variant="label" muted>
        Quick travel · tap to log, hold to edit
      </AppText>
      <QuickTravel />
      <TransactionForm
        // Remount when opened with different prefill params.
        key={JSON.stringify(params)}
        initial={{
          type,
          categoryId: params.categoryId,
          amount: Number.isFinite(amount) ? amount : undefined,
          fundId: params.fundId,
          toAccountId: params.toAccountId,
          accountId: params.accountId,
          note: params.note,
        }}
        ruleId={params.ruleId}
        onDone={() => {
          // A reminder's prefill is one-shot: clear it so the next entry is independent.
          if (params.ruleId) {
            router.setParams({
              ruleId: undefined,
              amount: undefined,
              note: undefined,
              categoryId: undefined,
              fundId: undefined,
              type: undefined,
            });
          }
        }}
      />
    </Screen>
  );
}
