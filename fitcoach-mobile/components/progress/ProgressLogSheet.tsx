// The "log today" check-in sheet: weight, measurements and a note.
// Validation mirrors the backend's jakarta rules via lib/validation.ts.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { LogProgressPayload } from '../../lib/api/types';
import { ProgressSchema, type ProgressForm } from '../../lib/validation';
import { Button, Field, ModalSheet } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { todayISO } from '../../lib/format';

export interface ProgressLogSheetProps {
  visible: boolean;
  saving: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (payload: LogProgressPayload) => void;
}

export function ProgressLogSheet({ visible, saving, serverError, onClose, onSubmit }: ProgressLogSheetProps) {
  const { control, handleSubmit, reset } = useForm<ProgressForm>({
    resolver: zodResolver(ProgressSchema),
    defaultValues: { weight: '', waist: '', chest: '', hips: '', notes: '' },
  });

  const submit = (data: ProgressForm) => {
    const measurements: Record<string, number> = {};
    if (data.waist.trim()) measurements.waist = Number(data.waist);
    if (data.chest.trim()) measurements.chest = Number(data.chest);
    if (data.hips.trim()) measurements.hips = Number(data.hips);
    onSubmit({
      weightKg: data.weight.trim() ? Number(data.weight) : null,
      measurements,
      notes: data.notes.trim(),
    });
  };

  return (
    <ModalSheet visible={visible} onClose={() => { reset(); onClose(); }} title={`Check-in · ${todayISO()}`}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
        <Controller control={control} name="weight" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Weight (kg)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. 78.4" keyboardType="decimal-pad" prefixIcon="scale-outline" />
        )} />
        <View style={{ flexDirection: 'row' }}>
          {(['waist', 'chest', 'hips'] as const).map((key, i) => (
            <View key={key} style={{ flex: 1, marginRight: i < 2 ? S.sm : 0 }}>
              <Controller control={control} name={key} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label={`${key[0]!.toUpperCase()}${key.slice(1)} (cm)`} value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="—" keyboardType="decimal-pad" />
              )} />
            </View>
          ))}
        </View>
        <Controller control={control} name="notes" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Notes" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Sleep, energy, soreness…" multiline numberOfLines={3} />
        )} />
        <Button label={saving ? 'Saving…' : 'Save check-in'} loading={saving} onPress={handleSubmit(submit)} />
        <Text style={[TYPE.caption, styles.hint]}>Visible to your coach instantly</Text>
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginBottom: S.md },
  hint: { textAlign: 'center', marginTop: S.md },
});
