// The most recent progress check-in: headline numbers, notes, how long ago.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../ui';
import type { ProgressEntry } from '../../lib/api/types';
import { S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface LatestCheckInCardProps {
  entry?: ProgressEntry;
}

export function LatestCheckInCard({ entry }: LatestCheckInCardProps) {
  if (!entry) return null;
  // measurements is a free-form map; only the keys the log sheet writes are labelled.
  const headline = [
    entry.weightKg ? `${entry.weightKg} kg` : null,
    ...(['waist', 'chest', 'hips'] as const).map((k) =>
      entry.measurements[k] ? `${k} ${entry.measurements[k]}cm` : null
    ),
  ].filter(Boolean).join(' · ');

  return (
    <Card style={{ marginTop: S.md }}>
      <View style={styles.head}>
        <Text style={[TYPE.h3, { flex: 1 }]}>Latest check-in</Text>
        <Text style={TYPE.caption}>{timeAgo(entry.createdAt).toUpperCase()}</Text>
      </View>
      <Text style={TYPE.sub}>{headline || 'Logged'}</Text>
      {entry.notes ? <Text style={styles.note}>“{entry.notes}”</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  note: { ...TYPE.sub, marginTop: 6, fontStyle: 'italic' },
});
