// Dashboard teaser that links to the full progress tracker.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui';
import type { ProgressEntry } from '../../lib/api/types';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface ProgressTeaserRowProps {
  latest?: ProgressEntry;
  onPress: () => void;
}

export function ProgressTeaserRow({ latest, onPress }: ProgressTeaserRowProps) {
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name="trending-up" size={19} color={C.blue} /></View>
        <View style={styles.body}>
          <Text style={TYPE.h3}>{latest?.weightKg ? `${latest.weightKg} kg` : 'No entries yet'}</Text>
          <Text style={TYPE.sub}>{latest ? `Last check-in ${timeAgo(latest.createdAt)}` : 'Log today to start your trend'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: S.md },
});
