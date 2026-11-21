import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { toCSV } from '@/lib/csv';
import { todayISO } from '@/lib/dates';

import { listTransactions } from '../transactions/repo';

/**
 * Writes all transactions in [start, end] to a CSV file and opens the share sheet
 * (save to Drive, email, WhatsApp…). Returns the number of rows exported.
 */
export async function exportTransactionsCSV(
  start = '0000-01-01',
  end = '9999-12-31',
): Promise<number> {
  const rows = listTransactions({ start, end });
  const csv = toCSV(
    [
      'Date',
      'Type',
      'Amount (INR)',
      'Category',
      'Parent category',
      'Account',
      'To account',
      'Fund',
      'Note',
    ],
    rows.map((r) => [
      r.date,
      r.type,
      (r.amount / 100).toFixed(2),
      r.categoryName,
      r.parentCategoryName,
      r.accountName,
      r.toAccountName,
      r.fundName,
      r.note,
    ]),
  );

  const file = new File(Paths.cache, `clayfin-${todayISO()}.csv`);
  if (file.exists) file.delete();
  file.create();
  // BOM so Excel opens ₹ and other UTF-8 text correctly.
  file.write('﻿' + csv);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export transactions',
    UTI: 'public.comma-separated-values-text',
  });
  return rows.length;
}
