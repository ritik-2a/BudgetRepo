import { router } from 'expo-router';
import { useState } from 'react';

import {
  AppText,
  IconButton,
  ListCard,
  ListRow,
  Screen,
  SegmentedControl,
} from '@/components/clay';
import { ErrorState, SkeletonList } from '@/components/feedback';
import type { CategoryKind } from '@/db/schema';
import { groupCategories, useCategories } from '@/features/categories/repo';
import { formatINR } from '@/lib/money';

export default function CategoriesScreen() {
  const [kind, setKind] = useState<CategoryKind>('expense');
  const { data, loading, error } = useCategories(kind);
  const groups = groupCategories(data);
  const open = (id: string, extra?: Record<string, string>) =>
    router.push({ pathname: '/categories/[id]', params: { id, ...extra } });

  return (
    <Screen
      title="Categories"
      back
      right={<IconButton icon="add" label="Add category" onPress={() => open('new', { kind })} />}
    >
      <SegmentedControl
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'investment', label: 'Investment' },
        ]}
        value={kind}
        onChange={setKind}
      />
      {error ? (
        <ErrorState title="Couldn't load categories" error={error} />
      ) : loading ? (
        <SkeletonList rows={6} />
      ) : (
        <ListCard>
          {groups.map(({ parent, children }) => [
            <ListRow
              key={parent.id}
              icon={parent.icon}
              iconColor={parent.color}
              title={parent.name}
              subtitle={
                parent.quickAmount
                  ? `Quick add ${formatINR(parent.quickAmount)}`
                  : children.length
                    ? `${children.length} sub-categories`
                    : null
              }
              onPress={() => open(parent.id)}
            />,
            ...children.map((c) => (
              <ListRow
                key={c.id}
                icon={c.icon}
                iconColor={c.color}
                title={`   ↳ ${c.name}`}
                subtitle={c.quickAmount ? `Quick add ${formatINR(c.quickAmount)}` : null}
                onPress={() => open(c.id)}
              />
            )),
          ])}
        </ListCard>
      )}
      <AppText variant="caption" muted>
        Set a quick-add amount on a category (like Auto or Metro) to get a one-tap button on the Add
        screen.
      </AppText>
    </Screen>
  );
}
