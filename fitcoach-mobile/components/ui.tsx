// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View, ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { C, R, S, SHADOW, TYPE, avatarColor } from '../theme/tokens';
import { initials } from '../lib/format';
import { useUIStore } from '../state/uiStore';

// ---------------------------------------------------------------- Screen ---
export function Screen({ children, style, noPad }: { children: React.ReactNode; style?: ViewStyle; noPad?: boolean }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      <View style={[styles.screenInner, noPad ? null : styles.pad]}>{children}</View>
    </SafeAreaView>
  );
}

export function ScrollScreen({ children, style, contentStyle }: { children: React.ReactNode; style?: ViewStyle; contentStyle?: ViewStyle }) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top', 'left', 'right']}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.pad, { paddingBottom: 48 }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- TopBar ---
export function TopBar({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: React.ReactNode; back?: boolean }) {
  const nav = useNavigation();
  return (
    <View style={styles.topbar}>
      <View style={styles.topbarLeft}>
        {back && nav.canGoBack() ? (
          <Pressable hitSlop={10} onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </Pressable>
        ) : null}
        <View>
          <Text style={TYPE.h2} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.topbarSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- Button ---
type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger' | 'dangerSoft';
export function Button({
  label, onPress, variant = 'primary', icon, loading, disabled, style, compact,
}: {
  label: string; onPress?: () => void; variant?: BtnVariant; icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean; disabled?: boolean; style?: ViewStyle; compact?: boolean;
}) {
  const bg: Record<BtnVariant, string> = {
    primary: C.primary, soft: C.primarySoft, ghost: 'transparent',
    outline: C.surface, danger: C.danger, dangerSoft: C.dangerSoft,
  };
  const fg: Record<BtnVariant, string> = {
    primary: C.white, soft: C.primaryDark, ghost: C.primary,
    outline: C.ink, danger: C.white, dangerSoft: C.danger,
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        { backgroundColor: bg[variant], opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        variant === 'outline' && styles.btnOutline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 15 : 18} color={fg[variant]} style={{ marginRight: 7 }} /> : null}
          <Text style={{ color: fg[variant], fontSize: compact ? 13 : 15, fontWeight: '700' }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// ------------------------------------------------------------------ Card ---
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      {inner}
    </Pressable>
  );
}

// ----------------------------------------------------------------- Field ---
export function Field({
  label, value, onChangeText, error, placeholder, secureTextEntry, keyboardType,
  multiline, numberOfLines, autoCapitalize, prefixIcon, suffix, editable = true, returnKeyType, onSubmitEditing,
}: {
  label?: string; value: string; onChangeText: (t: string) => void; error?: string;
  placeholder?: string; secureTextEntry?: boolean; keyboardType?: TextInputProps['keyboardType'];
  multiline?: boolean; numberOfLines?: number; autoCapitalize?: TextInputProps['autoCapitalize'];
  prefixIcon?: keyof typeof Ionicons.glyphMap; suffix?: React.ReactNode; editable?: boolean;
  returnKeyType?: TextInputProps['returnKeyType']; onSubmitEditing?: () => void;
}) {
  return (
    <View style={{ marginBottom: error ? S.sm : S.lg }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.fieldBox, error ? styles.fieldBoxError : null, multiline && { minHeight: 88, alignItems: 'flex-start' }]}>
        {prefixIcon ? <Ionicons name={prefixIcon} size={17} color={C.faint} style={{ marginRight: 8, marginTop: multiline ? 3 : 0 }} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={autoCapitalize}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          style={[styles.fieldInput, multiline && { textAlignVertical: 'top', paddingTop: 2 }]}
        />
        {suffix}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ----------------------------------------------------------------- Badge ---
export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue' }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    green: { bg: C.primarySoft, fg: C.primaryDark },
    amber: { bg: C.accentSoft, fg: '#9A6712' },
    red: { bg: C.dangerSoft, fg: C.danger },
    gray: { bg: C.surfaceAlt, fg: C.sub },
    blue: { bg: C.blueSoft, fg: C.blue },
  };
  const t = tones[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: t.fg, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={{ color: C.sub, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- Avatar ---
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const c = avatarColor(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.fg, fontSize: size * 0.36, fontWeight: '800' }}>{initials(name)}</Text>
    </View>
  );
}

// -------------------------------------------------------------- StatTile ---
export function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'green' ? { color: C.primary } : tone === 'red' ? { color: C.danger } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------- SectionHeader ---
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

// ------------------------------------------------------------ Empty/Error ---
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

// ----------------------------------------------------------------- Toast ---
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
  const icon = toast.kind === 'error' ? 'alert-circle-outline' : toast.kind === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutDown.duration(180)} style={[styles.toast, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={17} color="#fff" style={{ marginRight: 8 }} />
        <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600', flexShrink: 1 }}>{toast.text}</Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- styles ---
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenInner: { flex: 1 },
  pad: { paddingHorizontal: S.xl, paddingTop: S.lg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xl },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: S.md },
  topbarSub: { ...TYPE.caption, marginTop: 2 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 14, minHeight: 50 },
  btnCompact: { paddingHorizontal: 14, paddingVertical: 9, minHeight: 0, borderRadius: R.sm },
  btnOutline: { borderWidth: 1, borderColor: C.line },
  card: { backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.lineSoft, padding: S.lg, ...SHADOW.card },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 7 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, minHeight: 50 },
  fieldBoxError: { borderColor: C.danger },
  fieldInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 13, fontWeight: '500' },
  fieldError: { color: C.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  chip: { backgroundColor: C.surfaceAlt, borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
  statTile: { flex: 1, backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.lineSoft, padding: S.md, ...SHADOW.card },
  statLabel: { fontSize: 11, fontWeight: '700', color: C.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 19, fontWeight: '800', color: C.ink, marginTop: 4 },
  statSub: { fontSize: 11.5, color: C.sub, marginTop: 2, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.xxl, marginBottom: S.md },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, paddingHorizontal: S.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(24,36,32,0.42)', justifyContent: 'flex-end' },
  celebrationBackdrop: { flex: 1, backgroundColor: 'rgba(24,36,32,0.5)', alignItems: 'center', justifyContent: 'center', padding: S.xxl },
  celebrationCard: { backgroundColor: C.surface, borderRadius: R.xl, padding: S.xxl, width: '100%', maxWidth: 360, alignItems: 'center', ...SHADOW.float },
  badgeCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F0DFBC' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: S.xl, paddingBottom: 40, maxHeight: '86%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.lg },
  sheetClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', borderRadius: R.full, paddingHorizontal: 18, paddingVertical: 12, maxWidth: '88%', ...SHADOW.float },
});
