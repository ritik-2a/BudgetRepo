import { Screen } from '@/components/clay';
import { ComingSoon } from '@/components/ComingSoon';

export default function TransactionsScreen() {
  return (
    <Screen title="History" subtitle="All transactions">
      <ComingSoon
        icon="list"
        title="Transaction history"
        phase="Phase 1"
        items={[
          'Grouped by day with totals',
          'Filter by type, account and category',
          'Search notes',
        ]}
      />
    </Screen>
  );
}
