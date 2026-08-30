// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { C, R, SHADOW } from '../../theme/tokens';
import { useUIStore } from '../../state/uiStore';

const styles = StyleSheet.create({
  toast: { flexDirection: 'row', alignItems: 'center', borderRadius: R.full, paddingHorizontal: 18, paddingVertical: 12, maxWidth: '88%', ...SHADOW.float },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', zIndex: 100 },
});

export function ToastHost() {
  const toast = useUIStore((s) => s.toast);
  const dismiss = useUIStore((s) => s.dismissToast);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(dismiss, 2600);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, dismiss]);

  if (!toast) return null;
  const bg = toast.kind === 'error' ? C.danger : toast.kind === 'success' ? C.primary : C.ink;
  const icon: keyof typeof Ionicons.glyphMap =
    toast.kind === 'error' ? 'alert-circle-outline' : toast.kind === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutDown.duration(180)} style={[styles.toast, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={17} color={C.white} style={{ marginRight: 8 }} />
        <Text style={{ color: C.white, fontSize: 13.5, fontWeight: '600', flexShrink: 1 }}>{toast.text}</Text>
      </Animated.View>
    </View>
  );
}
