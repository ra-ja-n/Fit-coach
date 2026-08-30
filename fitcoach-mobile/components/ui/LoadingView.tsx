// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { C, S, TYPE } from '../../theme/tokens';
import { ModalSheet } from './ModalSheet';

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: S.xl },
});

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={[styles.empty, { paddingVertical: 60 }]}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={[TYPE.sub, { marginTop: S.md }]}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------- ModalSheet ---
// IMPORTANT: the sheet itself is a Pressable with a no-op onPress. On web this
// stops click propagation to the backdrop layer — without it, tapping a text
// input inside the sheet also fired the backdrop's onClose (sheet "closed on
// its own" while typing).
