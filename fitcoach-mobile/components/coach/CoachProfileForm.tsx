// The coach's editable public profile: avatar, approval badge, bio,
// specialties and experience.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CoachProfile, UpdateCoachProfilePayload } from '../../lib/api/types';
import { ProfileSchema, type ProfileForm as ProfileFormValues } from '../../lib/validation';
import { Avatar, Badge, Button, Card, Field } from '../ui';
import { S, TYPE } from '../../theme/tokens';

export interface CoachProfileFormProps {
  initial: CoachProfile;
  saving: boolean;
  onSave: (payload: UpdateCoachProfilePayload) => void;
}

export function CoachProfileForm({ initial, saving, onSave }: CoachProfileFormProps) {
  const { control, handleSubmit } = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      bio: initial.bio,
      specialties: initial.specialties.join(', '),
      experienceYears: String(initial.experienceYears),
    },
  });

  const submit = (d: ProfileFormValues) =>
    onSave({
      bio: d.bio.trim(),
      specialties: d.specialties.split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(d.experienceYears),
    });

  return (
    <Card>
      <View style={styles.head}>
        <Avatar name={initial.name} size={44} />
        <View style={styles.nameWrap}>
          <Text style={TYPE.h3}>{initial.name}</Text>
          <Badge label={initial.status.toUpperCase()} tone={initial.status === 'approved' ? 'green' : 'amber'} />
        </View>
      </View>
      <Controller control={control} name="bio" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Bio" value={value} onChangeText={onChangeText} error={fieldState.error?.message} multiline numberOfLines={4} />
      )} />
      <Controller control={control} name="specialties" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Specialties (comma separated)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Fat loss, Strength" />
      )} />
      <Controller control={control} name="experienceYears" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Experience (years)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
      )} />
      <Button label={saving ? 'Saving…' : 'Save profile'} loading={saving} onPress={handleSubmit(submit)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: S.lg },
  nameWrap: { marginLeft: S.md, flex: 1 },
});
