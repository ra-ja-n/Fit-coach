// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { C, R, S, TYPE } from '../../theme/tokens';
import { Badge } from './Badge';
import { CelebrationModal } from './CelebrationModal';

const styles = StyleSheet.create({
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.xl, paddingBottom: 40, maxHeight: '86%' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(24,36,32,0.42)', justifyContent: 'flex-end' },
  sheetClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg },
});

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ModalSheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <AnimatedPressable onPress={() => {}} style={styles.sheet} entering={FadeInDown.duration(220).springify()}>
            <View style={styles.sheetHeader}>
              <Text style={TYPE.h3}>{title}</Text>
              <Pressable hitSlop={10} onPress={onClose} style={styles.sheetClose}>
                <Ionicons name="close" size={18} color={C.sub} />
              </Pressable>
            </View>
            {children}
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// -------------------------------------------------------- CelebrationModal ---
// Badge/congrats popup for gamified milestones (day done, plan done, diet done).
