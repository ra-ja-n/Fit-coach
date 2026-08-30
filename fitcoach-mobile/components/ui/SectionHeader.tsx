// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, S } from '../../theme/tokens';

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.xxl, marginBottom: S.md },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
});

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable hitSlop={8} onPress={onAction}>
          <Text style={{ color: C.primary, fontSize: 13.5, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
