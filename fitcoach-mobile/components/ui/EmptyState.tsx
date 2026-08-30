// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, S, TYPE } from '../../theme/tokens';
import { Button } from './Button';

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: S.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});

export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={C.primary} />
      </View>
      <Text style={[TYPE.h3, { textAlign: 'center', marginTop: S.md }]}>{title}</Text>
      <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.xs, maxWidth: 300 }]}>{body}</Text>
      {actionLabel ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: S.xl, alignSelf: 'center' }} /> : null}
    </View>
  );
}
