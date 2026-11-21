import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { Screen } from '@/components/clay';
import { EmptyState } from '@/components/feedback';
import { getTransaction } from '@/features/transactions/repo';
import { TransactionForm } from '@/features/transactions/TransactionForm';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useMemo(() => (id ? getTransaction(id) : undefined), [id]);

  return (
    <Screen title="Edit transaction" back>
      {tx ? (
        <TransactionForm editId={tx.id} initial={tx} onDone={() => router.back()} />
      ) : (
        <EmptyState
          icon="search"
          title="Transaction not found"
          message="It may have been deleted."
          action={{ label: 'Go back', icon: 'arrow-forward', onPress: () => router.back() }}
        />
      )}
    </Screen>
  );
}
