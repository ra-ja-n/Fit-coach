// Inline "this is locked / ended" strip shown when a subscription has lapsed.
// Same visual everywhere so a lapsed plan reads identically across screens.
import React from 'react';
import { StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '../../theme/tokens';

export interface LockedNoticeProps {
  text: string;
  /** 'lock' for access removed, 'info' for a neutral heads-up. */
  tone?: 'lock' | 'info';
  style?: StyleProp<ViewStyle>;
}

export function LockedNotice({ text, tone = 'lock', style }: LockedNoticeProps) {
  return (
    <View style={[styles.bar, style]}>
      <Ionicons
        name={tone === 'lock' ? 'lock-closed-outline' : 'bulb-outline'}
        size={14}
        color={C.accentInk}
        style={styles.icon}
      />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft,
    borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, marginTop: S.sm,
  },
  icon: { marginRight: 8 },
  text: { fontSize: 12.5, fontWeight: '700', color: C.accentInk, flex: 1 },
});
