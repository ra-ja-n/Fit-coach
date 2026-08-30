// Sandbox-only selector for which card result the simulated provider should
// return. Real payments never show this.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui';
import { C, R, S } from '../../theme/tokens';

export type SandboxMode = 'success' | 'decline';

export interface SandboxModePickerProps {
  mode: SandboxMode;
  onChange: (mode: SandboxMode) => void;
}

export function SandboxModePicker({ mode, onChange }: SandboxModePickerProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>SANDBOX · SIMULATE CARD RESULT</Text>
      <View style={{ flexDirection: 'row' }}>
        {(['success', 'decline'] as const).map((m) => (
          <Button
            key={m}
            label={m === 'success' ? 'Card approved' : 'Card declined'}
            compact
            variant={mode === m ? 'primary' : 'outline'}
            style={[styles.button, m === 'success' && { marginRight: S.sm }]}
            onPress={() => onChange(m)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.surfaceAlt, borderRadius: R.lg, padding: S.lg, marginTop: S.lg },
  title: { fontSize: 10.5, fontWeight: '800', color: C.sub, letterSpacing: 0.6, marginBottom: S.md },
  button: { flex: 1 },
});
