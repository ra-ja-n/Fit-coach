// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { StyleSheet, Text, View } from 'react-native';
import { C, R, S, SHADOW } from '../../theme/tokens';

const styles = StyleSheet.create({
  statLabel: { fontSize: 11, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  statSub: { fontSize: 11.5, color: C.sub, marginTop: 2, fontWeight: '600' },
  statTile: { flex: 1, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: S.md, ...SHADOW.card },
  statValue: { fontSize: 19, fontWeight: '800', color: C.ink, marginTop: 4 },
});

export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'green' ? { color: C.primary } : tone === 'red' ? { color: C.danger } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}
