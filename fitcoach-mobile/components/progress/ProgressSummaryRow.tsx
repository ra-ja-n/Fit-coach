// Start / Current / Change tiles plus the trend chart. Shared by the client's
// own progress hub and the coach's per-client view.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, StatTile } from '../ui';
import { ProgressChart } from './ProgressChart';
import type { ProgressEntry } from '../../lib/api/types';
import { S, TYPE } from '../../theme/tokens';

export interface ProgressSummaryRowProps {
  /** Newest first, as the API returns it. */
  entries: ProgressEntry[];
  /** Hide the chart card when there is nothing to plot. */
  showChart?: boolean;
}

export function progressStats(entries: ProgressEntry[]) {
  const chrono = [...entries].reverse().filter((e) => e.weightKg != null);
  const current = entries.find((e) => e.weightKg != null)?.weightKg ?? null;
  const first = chrono.length ? chrono[0]!.weightKg : null;
  const delta = current != null && first != null ? +(current - first).toFixed(1) : null;
  return { chrono, current, first, delta };
}

export function ProgressSummaryRow({ entries, showChart = true }: ProgressSummaryRowProps) {
  const { chrono, current, first, delta } = progressStats(entries);

  return (
    <>
      <View style={{ flexDirection: 'row' }}>
        <StatTile label="Start" value={first != null ? `${first} kg` : '—'} />
        <View style={styles.gap} />
        <StatTile label="Current" value={current != null ? `${current} kg` : '—'} />
        <View style={styles.gap} />
        <StatTile
          label="Change"
          value={delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'}
          tone={delta != null ? (delta <= 0 ? 'green' : 'red') : undefined}
        />
      </View>

      {showChart && chrono.length >= 2 ? (
        <Card style={{ marginTop: S.lg }}>
          <Text style={[TYPE.caption, { marginBottom: S.sm }]}>WEIGHT TREND</Text>
          <ProgressChart data={chrono.map((e) => ({ date: e.date, value: e.weightKg! }))} />
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  gap: { width: S.md },
});
