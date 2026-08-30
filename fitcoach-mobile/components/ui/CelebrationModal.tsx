// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { C, R, S, SHADOW, TYPE } from '../../theme/tokens';
import { Button } from './Button';

const styles = StyleSheet.create({
  badgeCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.accentLine },
  celebrationBackdrop: { flex: 1, backgroundColor: 'rgba(24,36,32,0.5)', alignItems: 'center', justifyContent: 'center', padding: S.xxl },
  celebrationCard: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.xxl, width: '100%', maxWidth: 360, alignItems: 'center', ...SHADOW.float },
});

export function CelebrationModal({ visible, emoji, title, subtitle, onClose, ctaLabel = 'Awesome!' }: {
  visible: boolean; emoji: string; title: string; subtitle: string; onClose: () => void; ctaLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.celebrationBackdrop}>
        <Animated.View entering={FadeInDown.duration(260).springify()} style={styles.celebrationCard}>
          <View style={styles.badgeCircle}>
            <Text style={{ fontSize: 42 }}>{emoji}</Text>
          </View>
          <Text style={[TYPE.h1, { textAlign: 'center', marginTop: S.lg }]}>{title}</Text>
          <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.sm, lineHeight: 20 }]}>{subtitle}</Text>
          <Button label={ctaLabel} onPress={onClose} style={{ marginTop: S.xl, alignSelf: 'stretch' }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
