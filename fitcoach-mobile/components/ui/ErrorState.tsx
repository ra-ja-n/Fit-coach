// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, S, TYPE } from '../../theme/tokens';
import { Button } from './Button';

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: S.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: C.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.danger} />
      </View>
      <Text style={[TYPE.h3, { textAlign: 'center', marginTop: S.md }]}>Something went wrong</Text>
      <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.xs, maxWidth: 300 }]}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="soft" style={{ marginTop: S.xl, alignSelf: 'center' }} /> : null}
    </View>
  );
}
