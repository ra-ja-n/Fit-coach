// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '../../theme/tokens';

const styles = StyleSheet.create({
  fieldBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, minHeight: 50 },
  fieldBoxError: { borderColor: C.danger },
  fieldError: { color: C.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6 },
  fieldInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 13, fontWeight: '500' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 7 },
});

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
