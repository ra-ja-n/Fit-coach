// The tick box shared by workout and diet check-offs.
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme/tokens';

export interface CheckBoxProps {
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export function CheckBox({ checked, disabled, onPress }: CheckBoxProps) {
  return (
    <Pressable
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.box, checked && styles.boxOn, disabled && { opacity: 0.5 }]}
    >
      {checked ? <Ionicons name="checkmark" size={14} color={C.white} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.line,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: C.primary, borderColor: C.primary },
});
