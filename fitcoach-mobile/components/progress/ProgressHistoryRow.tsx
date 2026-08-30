// One row of the client's check-in history: date, headline numbers, note and a
// photo thumbnail when there is one.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Card } from '../ui';
import type { ProgressEntry } from '../../lib/api/types';
import { C, R, S, TYPE } from '../../theme/tokens';
import { fmtDay } from '../../lib/format';

export interface ProgressHistoryRowProps {
  entry: ProgressEntry;
  onOpenPhoto: (uri: string, label: string) => void;
}

export function progressHeadline(entry: ProgressEntry): string {
  return [
    entry.weightKg ? `${entry.weightKg} kg` : null,
    ...(['waist', 'chest', 'hips'] as const).map((k) =>
      entry.measurements[k] ? `${k} ${entry.measurements[k]}cm` : null
    ),
  ].filter(Boolean).join(' · ');
}

export function ProgressHistoryRow({ entry, onOpenPhoto }: ProgressHistoryRowProps) {
  const photo = entry.photoUrls.length > 0 ? entry.photoUrls[entry.photoUrls.length - 1]! : null;

  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.h3}>{fmtDay(entry.date)}</Text>
          <Text style={TYPE.sub}>{progressHeadline(entry) || 'Check-in'}</Text>
        </View>
        {photo ? (
          <Pressable onPress={() => onOpenPhoto(photo, fmtDay(entry.date))}>
            <Image source={{ uri: photo }} style={styles.thumb} />
          </Pressable>
        ) : null}
      </View>
      {entry.notes ? <Text style={styles.note}>“{entry.notes}”</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 52, height: 62, borderRadius: R.sm, backgroundColor: C.surfaceAlt },
  note: { ...TYPE.sub, marginTop: S.sm, fontStyle: 'italic' },
});
