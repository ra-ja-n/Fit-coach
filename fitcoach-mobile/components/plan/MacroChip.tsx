// Tiny macro badge (P / C / F) used on diet items and summaries.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { R } from '../../theme/tokens';

export interface MacroChipProps {
  label: string;
  color: string;
}

export function MacroChip({ label, color }: MacroChipProps) {
  return (
    <View style={[styles.chip, { backgroundColor: `${color}18` }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2, marginRight: 5 },
  text: { fontSize: 10.5, fontWeight: '700' },
});
