import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  SegmentedControl,
  SwitchRow,
} from '@/components/clay';
import { useToast } from '@/components/feedback';
import { formatINR, parseRupees } from '@/lib/money';
import { computeSplit, type SplitMode } from '@/lib/split';
import { useTheme } from '@/theme';

import { createPerson, usePeople } from '../accounts/repo';

export type SplitState = {
  enabled: boolean;
  includeMe: boolean;
  personIds: string[];
  mode: SplitMode;
  /** Text inputs per person (rupees) for custom mode */
  custom: Record<string, string>;
};

export const EMPTY_SPLIT: SplitState = {
  enabled: false,
  includeMe: true,
  personIds: [],
  mode: 'equal',
  custom: {},
};

export function splitFromState(total: number | null, s: SplitState) {
  const custom: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.custom)) custom[k] = parseRupees(v) ?? 0;
  return computeSplit({
    total: total ?? 0,
    includeMe: s.includeMe,
    personIds: s.personIds,
    mode: s.mode,
    custom,
  });
}

/** "Split with friends" card inside the expense form. */
export function SplitEditor({
  total,
  value,
  onChange,
  payerIsFriend,
}: {
  total: number | null;
  value: SplitState;
  onChange: (s: SplitState) => void;
  payerIsFriend: boolean;
}) {
  const t = useTheme();
  const toast = useToast();
  const people = usePeople().data;
  const [newName, setNewName] = useState('');
  const set = (patch: Partial<SplitState>) => onChange({ ...value, ...patch });
  const result = value.enabled ? splitFromState(total, value) : null;

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    const existing = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? createPerson(name);
    if (!existing) toast.success('Friend added', name);
    setNewName('');
    set({ personIds: value.personIds.includes(id) ? value.personIds : [...value.personIds, id] });
  };

  return (
    <ClayCard style={styles.card}>
      <SwitchRow
        icon="people"
        title="Split with friends"
        subtitle={
          payerIsFriend
            ? 'A friend paid. Only your share is recorded, as money you owe them.'
            : 'Only your share counts as your spending. Friends’ shares become money they owe you.'
        }
        value={value.enabled}
        onChange={(enabled) => set({ enabled })}
      />

      {value.enabled ? (
        <>
          <AppText variant="label" muted>
            With
          </AppText>
          <ChipRow>
            {people.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                icon="person"
                selected={value.personIds.includes(p.id)}
                onPress={() =>
                  set({
                    personIds: value.personIds.includes(p.id)
                      ? value.personIds.filter((x) => x !== p.id)
                      : [...value.personIds, p.id],
                  })
                }
              />
            ))}
          </ChipRow>
          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Add a friend by name"
              placeholderTextColor={t.colors.textMuted}
              onSubmitEditing={addPerson}
              returnKeyType="done"
              style={[
                styles.addInput,
                {
                  color: t.colors.text,
                  borderColor: t.colors.border,
                  backgroundColor: t.colors.surface,
                },
              ]}
            />
            <ClayButton
              icon="person-add"
              variant="secondary"
              onPress={addPerson}
              accessibilityLabel="Add friend"
            />
          </View>

          {!payerIsFriend ? (
            <SwitchRow
              title="Include me"
              subtitle="Turn off if you only paid for others (e.g. a friend used your card)"
              value={value.includeMe}
              onChange={(includeMe) => set({ includeMe })}
            />
          ) : null}

          <SegmentedControl
            options={[
              { value: 'equal', label: 'Equally' },
              { value: 'custom', label: 'Custom amounts' },
            ]}
            value={value.mode}
            onChange={(mode) => set({ mode })}
          />

          {value.mode === 'custom'
            ? value.personIds.map((id) => {
                const p = people.find((x) => x.id === id);
                return (
                  <View key={id} style={styles.customRow}>
                    <AppText variant="body" style={styles.flex}>
                      {p?.name}
                    </AppText>
                    <TextInput
                      value={value.custom[id] ?? ''}
                      onChangeText={(v) => set({ custom: { ...value.custom, [id]: v } })}
                      placeholder="₹ share"
                      keyboardType="decimal-pad"
                      placeholderTextColor={t.colors.textMuted}
                      style={[
                        styles.customInput,
                        {
                          color: t.colors.text,
                          borderColor: t.colors.border,
                          backgroundColor: t.colors.surface,
                        },
                      ]}
                    />
                  </View>
                );
              })
            : null}

          {result ? (
            <View style={[styles.summary, { backgroundColor: t.colors.surfaceSunken }]}>
              {result.ok ? (
                <>
                  {value.includeMe || payerIsFriend ? (
                    <SummaryRow
                      label="Your share (your spending)"
                      value={formatINR(result.mine)}
                      strong
                    />
                  ) : null}
                  {!payerIsFriend
                    ? result.shares.map((s) => (
                        <SummaryRow
                          key={s.personId}
                          label={`${people.find((p) => p.id === s.personId)?.name ?? 'Friend'} owes you`}
                          value={formatINR(s.amount)}
                        />
                      ))
                    : null}
                </>
              ) : (
                <AppText variant="caption" color={t.colors.warning}>
                  {result.error}
                </AppText>
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </ClayCard>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <AppText variant="caption" muted={!strong} weight={strong ? '600' : undefined}>
        {label}
      </AppText>
      <AppText variant="caption" weight="600">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customInput: {
    width: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    textAlign: 'right',
  },
  flex: { flex: 1 },
  summary: { borderRadius: 12, padding: 12, gap: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
