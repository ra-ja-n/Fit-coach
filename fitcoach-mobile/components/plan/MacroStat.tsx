// One macro total in the diet summary row.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TYPE } from '../../theme/tokens';

export interface MacroStatProps {
  label: string;
  value: string;
  color: string;
}

export function MacroStat({ label, value, color }: MacroStatProps) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={[TYPE.caption, { marginTop: 2 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  value: { fontSize: 15, fontWeight: '800' },
});
