// Inline status callout (error / info) with a leading icon.
import React from 'react';
import { StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '../../theme/tokens';

export interface AlertBoxProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: 'danger' | 'info';
  style?: StyleProp<ViewStyle>;
}

export function AlertBox({ icon, text, tone = 'danger', style }: AlertBoxProps) {
  const bg = tone === 'danger' ? C.dangerSoft : C.blueSoft;
  const fg = tone === 'danger' ? C.danger : C.blue;

  return (
    <View style={[styles.box, { backgroundColor: bg }, style]}>
      <Ionicons name={icon} size={18} color={fg} style={styles.icon} />
      <Text style={[styles.text, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: R.md, padding: S.lg, marginTop: S.lg },
  icon: { marginRight: 10 },
  text: { fontSize: 13.5, fontWeight: '600', flex: 1, lineHeight: 19 },
});
