import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  ChipRow,
  ClayButton,
  ClayCard,
  ClayInput,
  IconBadge,
  Screen,
} from '@/components/clay';
import { EmptyState, useConfirm, useToast } from '@/components/feedback';
import { CATEGORY_KINDS, type CategoryKind } from '@/db/schema';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  archiveCategory,
  createCategory,
  getCategory,
  updateCategory,
  useCategories,
} from '@/features/categories/repo';
import { parseRupees } from '@/lib/money';
import { useTheme } from '@/theme';

export default function CategoryEditScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = params.id === 'new';
  const existing = useMemo(() => (isNew ? undefined : getCategory(params.id)), [isNew, params.id]);

  const [kind] = useState<CategoryKind>(
    existing?.kind ??
      (CATEGORY_KINDS.includes(params.kind as CategoryKind)
        ? (params.kind as CategoryKind)
        : 'expense'),
  );
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'pricetag');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);
  const [parentId, setParentId] = useState<string | null>(existing?.parentId ?? null);
  const [quick, setQuick] = useState(
    existing?.quickAmount ? String(existing.quickAmount / 100) : '',
  );
  const [nameError, setNameError] = useState<string>();
  const parents = useCategories(kind).data.filter((c) => !c.parentId && c.id !== existing?.id);

  if (!isNew && !existing) {
    return (
      <Screen title="Category" back>
        <EmptyState icon="search" title="Category not found" />
      </Screen>
    );
  }

  const save = () => {
    if (!name.trim()) {
      setNameError('Enter a name');
      toast.error('Enter a category name');
      return;
    }
    const quickAmount = quick.trim() ? parseRupees(quick) : null;
    if (quick.trim() && !quickAmount) {
      toast.error('Quick-add amount is not valid');
      return;
    }
    const input = { name, kind, icon, color, parentId, quickAmount };
    try {
      if (existing) updateCategory(existing.id, input);
      else createCategory(input);
      toast.success(existing ? 'Category updated' : 'Category added', name.trim());
      router.back();
    } catch (e) {
      toast.error("Couldn't save category", e);
    }
  };

  const archive = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `Remove ${existing.name}?`,
      message:
        'It will be hidden from pickers (sub-categories too). Past transactions keep their category.',
      destructive: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    archiveCategory(existing.id);
    toast.success('Category removed', existing.name);
    router.back();
  };

  return (
    <Screen title={existing ? 'Edit category' : 'New category'} back>
      <ClayCard style={styles.preview}>
        <IconBadge name={icon} color={color} size={56} />
        <AppText variant="title">{name.trim() || 'Category name'}</AppText>
        <AppText variant="caption" muted>
          {kind === 'expense' ? 'Expense' : kind === 'income' ? 'Income' : 'Investment'} category
        </AppText>
      </ClayCard>

      <ClayInput
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameError(undefined);
        }}
        placeholder="e.g. Petrol"
        error={nameError}
        maxLength={30}
      />

      {parents.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="label" muted>
            Group under (optional)
          </AppText>
          <ChipRow>
            <Chip label="None" selected={!parentId} onPress={() => setParentId(null)} />
            {parents.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                icon={p.icon}
                color={p.color}
                selected={parentId === p.id}
                onPress={() => setParentId(p.id)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {kind === 'expense' ? (
        <ClayInput
          label="Quick-add amount (optional)"
          value={quick}
          onChangeText={setQuick}
          placeholder="e.g. 50 for an auto ride"
          keyboardType="decimal-pad"
          prefix="₹"
        />
      ) : null}

      <View style={styles.section}>
        <AppText variant="label" muted>
          Icon
        </AppText>
        <View style={styles.grid}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              accessibilityRole="button"
              accessibilityLabel={`Icon ${i}`}
              accessibilityState={{ selected: icon === i }}
              style={[
                styles.iconCell,
                {
                  borderColor: icon === i ? color : 'transparent',
                  backgroundColor: t.colors.surface,
                },
              ]}
            >
              <IconBadge name={i} color={icon === i ? color : t.colors.textMuted} size={34} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" muted>
          Colour
        </AppText>
        <View style={styles.grid}>
          {CATEGORY_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Colour ${c}`}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderWidth: color === c ? 3 : 0,
                  borderColor: t.colors.text,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ClayButton title="Save" icon="checkmark" size="lg" fullWidth onPress={save} />
      {existing ? (
        <ClayButton
          title="Remove category"
          icon="trash"
          variant="secondary"
          fullWidth
          onPress={archive}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: 8 },
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { padding: 4, borderRadius: 16, borderWidth: 2 },
  swatch: { width: 36, height: 36, borderRadius: 12 },
});
