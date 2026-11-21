import { Screen } from '@/components/clay';
import { ComingSoon } from '@/components/ComingSoon';

export default function InsightsScreen() {
  return (
    <Screen title="Insights" subtitle="Dashboards">
      <ComingSoon
        icon="card"
        title="Credit Card"
        phase="Phase 2"
        items={['Spend in current billing cycle', 'Outstanding vs limit', 'Due-date countdown']}
      />
      <ComingSoon
        icon="trending-up"
        title="Mutual Funds"
        phase="Phase 3"
        items={['Invested this month and all time', 'Per-fund breakdown', 'SIP tracker']}
      />
      <ComingSoon
        icon="train"
        title="Travel"
        phase="Phase 3"
        items={['Auto vs Metro vs Cab', 'Average cost per trip']}
      />
      <ComingSoon
        icon="flag"
        title="Goals"
        phase="Phase 3"
        items={['Progress bars', 'Projected completion date']}
      />
    </Screen>
  );
}
