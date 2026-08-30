// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import { StyleProp, ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R } from '../../theme/tokens';

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingHorizontal: 20, paddingVertical: 14, minHeight: 50 },
  btnCompact: { paddingHorizontal: 14, paddingVertical: 9, minHeight: 0, borderRadius: R.sm },
  btnOutline: { borderWidth: 1, borderColor: C.line },
});

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'outline' | 'danger' | 'dangerSoft';
export function Button({
  label, onPress, variant = 'primary', icon, loading, disabled, style, compact,
}: {
  label: string; onPress?: () => void; variant?: BtnVariant; icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
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
