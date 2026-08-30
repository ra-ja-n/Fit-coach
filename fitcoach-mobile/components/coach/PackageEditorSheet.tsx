// Create/edit a coaching package. Prices are entered in dollars here and sent
// to the backend as cents — money never travels as a float.
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { request } from '../../lib/api/api';
import { errorMessage } from '../../lib/api/errors';
import type { Package, SavePackagePayload } from '../../lib/api/types';
import { useUIStore } from '../../state/uiStore';
import { PackageSchema, type PackageForm } from '../../lib/validation';
import { Button, Field, ModalSheet } from '../ui';
import { S } from '../../theme/tokens';

export interface PackageEditorSheetProps {
  visible: boolean;
  pkg: Package | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PackageEditorSheet({ visible, pkg, onClose, onSaved }: PackageEditorSheetProps) {
  const showToast = useUIStore((s) => s.showToast);
  const { control, handleSubmit, reset } = useForm<PackageForm>({
    resolver: zodResolver(PackageSchema),
    defaultValues: pkg
      ? { title: pkg.title, price: (pkg.priceCents / 100).toString(), durationDays: String(pkg.durationDays), featuresText: pkg.features.join('\n') }
      : { title: '', price: '', durationDays: '30', featuresText: '' },
  });

  const save = useMutation({
    mutationFn: (payload: SavePackagePayload) => request('package.save', payload),
    onSuccess: () => { reset(); onSaved(); },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  const submit = (d: PackageForm) =>
    save.mutate({
      id: pkg?.id,
      title: d.title.trim(),
      priceCents: Math.round(Number(d.price) * 100),
      durationDays: Number(d.durationDays),
      features: d.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
    });

  return (
    <ModalSheet visible={visible} onClose={() => { reset(); onClose(); }} title={pkg ? 'Edit package' : 'New package'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Controller control={control} name="title" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Title" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Monthly Coaching" />
        )} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: S.sm }}>
            <Controller control={control} name="price" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Price (USD)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="decimal-pad" placeholder="59" />
            )} />
          </View>
          <View style={{ flex: 1 }}>
            <Controller control={control} name="durationDays" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Duration (days)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
            )} />
          </View>
        </View>
        <Controller control={control} name="featuresText" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Features (one per line)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} multiline numberOfLines={4} placeholder={'Personalised workout plan\nChat support'} />
        )} />
        <Button label={save.isPending ? 'Saving…' : 'Save package'} loading={save.isPending} onPress={handleSubmit(submit)} />
      </ScrollView>
    </ModalSheet>
  );
}
