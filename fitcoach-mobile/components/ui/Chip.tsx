// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { StyleSheet, Text, View } from 'react-native';
import { C, R } from '../../theme/tokens';

const styles = StyleSheet.create({
  chip: { backgroundColor: C.surfaceAlt, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
});

export function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
