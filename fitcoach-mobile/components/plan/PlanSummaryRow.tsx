// A tappable row summarising one of the client's plans on their dashboard.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';

export interface PlanSummaryRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title?: string;
  sub?: string;
  emptyLabel: string;
  emptyBody: string;
  onPress?: () => void;
}

export function PlanSummaryRow({ icon, title, sub, emptyLabel, emptyBody, onPress }: PlanSummaryRowProps) {
  return (
    <Card style={{ marginBottom: S.md }} onPress={title ? onPress : undefined}>
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name={icon} size={19} color={C.primary} /></View>
        <View style={styles.body}>
          <Text style={[TYPE.h3, !title && { color: C.sub }]}>{title ?? emptyLabel}</Text>
          <Text style={TYPE.sub}>{title ? sub : emptyBody}</Text>
        </View>
        {title ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: S.md },
});
