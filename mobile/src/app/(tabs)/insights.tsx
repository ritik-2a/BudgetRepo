import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { ChipRow, Chip, Screen } from '@/components/clay';
import { CardDashboard } from '@/features/dashboards/CardDashboard';
import { FundsDashboard } from '@/features/dashboards/FundsDashboard';
import { GoalsDashboard } from '@/features/dashboards/GoalsDashboard';
import { OverviewDashboard } from '@/features/dashboards/OverviewDashboard';
import { TravelDashboard } from '@/features/dashboards/TravelDashboard';
import { useTheme } from '@/theme';

type Tab = 'overview' | 'card' | 'funds' | 'travel' | 'goals';

export default function InsightsScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'overview');
  // Follow deep links (e.g. Home → card due) even though the tab screen stays mounted.
  const [lastParam, setLastParam] = useState(params.tab);
  if (params.tab !== lastParam) {
    setLastParam(params.tab);
    if (params.tab) setTab(params.tab);
  }

  const tabs: { value: Tab; label: string; icon: string; color: string }[] = [
    { value: 'overview', label: 'Overall', icon: 'pie-chart', color: t.colors.primary },
    { value: 'card', label: 'Credit card', icon: 'card', color: t.colors.creditCard },
    { value: 'funds', label: 'Mutual funds', icon: 'trending-up', color: t.colors.investment },
    { value: 'travel', label: 'Travel', icon: 'train', color: t.colors.travel },
    { value: 'goals', label: 'Goals', icon: 'flag', color: t.colors.income },
  ];

  return (
    <Screen title="Insights" subtitle="Dashboards">
      <ChipRow>
        {tabs.map((x) => (
          <Chip
            key={x.value}
            label={x.label}
            icon={x.icon}
            color={x.color}
            selected={tab === x.value}
            onPress={() => setTab(x.value)}
          />
        ))}
      </ChipRow>
      {tab === 'overview' ? <OverviewDashboard /> : null}
      {tab === 'card' ? <CardDashboard /> : null}
      {tab === 'funds' ? <FundsDashboard /> : null}
      {tab === 'travel' ? <TravelDashboard /> : null}
      {tab === 'goals' ? <GoalsDashboard /> : null}
    </Screen>
  );
}
