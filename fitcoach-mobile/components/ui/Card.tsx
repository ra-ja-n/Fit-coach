// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import React from 'react';
import { StyleProp, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { C, R, S, SHADOW } from '../../theme/tokens';

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: S.lg, ...SHADOW.card },
});

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      {inner}
    </Pressable>
  );
}
