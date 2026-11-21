import { Screen } from '@/components/clay';
import { ComingSoon } from '@/components/ComingSoon';

export default function AddScreen() {
  return (
    <Screen title="Add" subtitle="New transaction">
      <ComingSoon
        icon="add-circle"
        title="Quick Add"
        phase="Phase 1"
        items={[
          'Expense, income, investment or transfer',
          'One-tap Auto / Metro buttons',
          'Pay credit card bill as a transfer',
        ]}
      />
    </Screen>
  );
}
