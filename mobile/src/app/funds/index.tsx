import { router } from 'expo-router';

import { IconButton, Screen } from '@/components/clay';
import { FundsDashboard } from '@/features/dashboards/FundsDashboard';

export default function FundsScreen() {
  return (
    <Screen
      title="Mutual funds"
      back
      right={<IconButton icon="add" label="Add fund" onPress={() => router.push('/funds/new')} />}
    >
      <FundsDashboard />
    </Screen>
  );
}
