import { router } from 'expo-router';

import { IconButton, Screen } from '@/components/clay';
import { GoalsDashboard } from '@/features/dashboards/GoalsDashboard';

export default function GoalsScreen() {
  return (
    <Screen
      title="Goals"
      back
      right={<IconButton icon="add" label="Add goal" onPress={() => router.push('/goals/new')} />}
    >
      <GoalsDashboard />
    </Screen>
  );
}
