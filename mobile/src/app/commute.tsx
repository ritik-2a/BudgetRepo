import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  ClayInput,
  Screen,
  SegmentedControl,
} from '@/components/clay';
import { Banner, useConfirm, useToast } from '@/components/feedback';
import { useAccounts } from '@/features/accounts/repo';
import { DEFAULT_COMMUTE, saveCommute } from '@/features/commute/repo';
import { setPref, usePrefs } from '@/features/settings/repo';
import { formatINR, parseRupees } from '@/lib/money';

const DAYS = [
  { d: 1, label: 'Mon' },
  { d: 2, label: 'Tue' },
  { d: 3, label: 'Wed' },
  { d: 4, label: 'Thu' },
  { d: 5, label: 'Fri' },
  { d: 6, label: 'Sat' },
  { d: 0, label: 'Sun' },
];

export default function CommuteSetupScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const prefs = usePrefs();
  const existing = prefs.commute;
  const accounts = useAccounts().data;
  const metroCards = accounts.filter((a) => a.type === 'metro_card');
  const choices = metroCards.length ? metroCards : accounts;

  const [accountId, setAccountId] = useState<string | null>(existing?.metroAccountId ?? null);
  const [fare, setFare] = useState(String((existing?.fare ?? DEFAULT_COMMUTE.fare) / 100));
  const [tripsPerDay, setTripsPerDay] = useState<'1' | '2'>(
    String(existing?.tripsPerDay ?? DEFAULT_COMMUTE.tripsPerDay) as '1' | '2',
  );
  const [workDays, setWorkDays] = useState<number[]>(
    existing?.workDays ?? DEFAULT_COMMUTE.workDays,
  );

  const effectiveAccount = accountId ?? metroCards[0]?.id ?? null;

  const save = () => {
    const farePaise = parseRupees(fare);
    if (!effectiveAccount) {
      toast.error('Add a metro card account first', 'Settings → Accounts → Add → Metro card');
      return;
    }
    if (!farePaise) {
      toast.error('Enter the one-way fare', 'For example 38.70');
      return;
    }
    if (workDays.length === 0) {
      toast.error('Pick at least one travel day');
      return;
    }
    saveCommute({
      metroAccountId: effectiveAccount,
      fare: farePaise,
      tripsPerDay: Number(tripsPerDay),
      workDays,
      overrides: existing?.overrides ?? {},
    });
    toast.success('Commute saved', `${formatINR(farePaise)} per trip`);
    router.back();
  };

  const turnOff = async () => {
    const ok = await confirm({
      title: 'Turn off the commute planner?',
      message: 'Your metro card and trips stay. Only the Home card goes away.',
      confirmLabel: 'Turn off',
    });
    if (!ok) return;
    setPref('commute', null);
    toast.info('Commute planner off');
    router.back();
  };

  return (
    <Screen title="Metro commute" back>
      <Banner
        tone="info"
        message="Clayfin uses your metro card balance and fare to show how many office days you can still travel and when to recharge."
      />
      <View style={styles.section}>
        <AppText variant="label" muted>
          Metro card account
        </AppText>
        <ChipRow>
          {choices.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={a.icon ?? 'train'}
              selected={effectiveAccount === a.id}
              onPress={() => setAccountId(a.id)}
            />
          ))}
          <Chip
            label="New metro card"
            icon="add"
            onPress={() =>
              router.push({ pathname: '/accounts/[id]', params: { id: 'new', type: 'metro_card' } })
            }
          />
        </ChipRow>
      </View>
      <ClayInput
        label="One-way fare"
        value={fare}
        onChangeText={setFare}
        keyboardType="decimal-pad"
        prefix="₹"
        placeholder="38.70"
      />
      <View style={styles.section}>
        <AppText variant="label" muted>
          Trips on an office day
        </AppText>
        <SegmentedControl
          options={[
            { value: '2', label: 'Round trip (2)' },
            { value: '1', label: 'One way (1)' },
          ]}
          value={tripsPerDay}
          onChange={setTripsPerDay}
        />
      </View>
      <ClayCard style={styles.section}>
        <AppText variant="label" muted>
          Days you usually travel
        </AppText>
        <View style={styles.days}>
          {DAYS.map(({ d, label }) => (
            <Chip
              key={d}
              label={label}
              selected={workDays.includes(d)}
              onPress={() =>
                setWorkDays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))
              }
            />
          ))}
        </View>
        <AppText variant="caption" muted>
          Mark individual WFH / leave days from the week strip on Home.
        </AppText>
      </ClayCard>
      <ClayButton title="Save" icon="checkmark" size="lg" fullWidth onPress={save} />
      {existing ? (
        <ClayButton title="Turn off planner" variant="secondary" fullWidth onPress={turnOff} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
