import { router } from 'expo-router';
import { memo } from 'react';

import { ListRow } from '@/components/clay';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { txTitle, type TxRow } from './repo';

export const TxListItem = memo(function TxListItem({
  tx,
  showDate,
}: {
  tx: TxRow;
  showDate?: boolean;
}) {
  const t = useTheme();
  const meta = {
    expense: { sign: '−', color: t.colors.text, icon: tx.categoryIcon ?? 'pricetag' },
    income: { sign: '+', color: t.colors.income, icon: tx.categoryIcon ?? 'cash' },
    investment: { sign: '', color: t.colors.investment, icon: 'trending-up' },
    transfer: { sign: '', color: t.colors.transfer, icon: 'swap-horizontal' },
  }[tx.type];
  const iconColor =
    tx.type === 'transfer'
      ? t.colors.transfer
      : tx.type === 'investment'
        ? t.colors.investment
        : (tx.categoryColor ?? t.colors.primary);

  const parts = [
    tx.type === 'transfer' ? 'Transfer' : tx.parentCategoryName,
    tx.type !== 'transfer' ? tx.accountName : null,
    tx.note,
    showDate ? tx.date.split('-').reverse().slice(0, 2).join('/') : null,
  ].filter(Boolean);

  return (
    <ListRow
      icon={meta.icon}
      iconColor={iconColor}
      title={txTitle(tx)}
      subtitle={parts.join(' · ')}
      right={`${meta.sign}${formatINR(tx.amount)}`}
      rightColor={meta.color}
      chevron={false}
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id } })}
    />
  );
});
