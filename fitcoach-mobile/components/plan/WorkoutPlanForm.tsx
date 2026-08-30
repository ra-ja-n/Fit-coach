// Coach-side workout plan editor. Used both to publish a client's live plan and
// to save a reusable library template — the only difference is which endpoint
// the submit mutation calls, and whether the "when to use this" note is shown.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useFieldArray, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { WorkoutPlan } from '../../lib/api/types';
import { WorkoutPlanSchema, type WorkoutPlanForm } from '../../lib/validation';
import { Button, Card, Field, TopBar } from '../ui';
import { C, R, S, TYPE } from '../../theme/tokens';

export interface WorkoutPlanFormProps {
  kind: 'workout' | 'diet';
  isTemplate: boolean;
  templateId?: string;
  initialNote: string;
  clientId?: string;
  clientName?: string;
  existing: WorkoutPlan | null;
  onSaved: () => void;
}

export function WorkoutPlanForm({ kind, isTemplate, templateId, initialNote, clientId, clientName, existing, onSaved }: WorkoutPlanFormProps) {
  const [note, setNote] = useState(initialNote);
  const { control, handleSubmit, formState: { errors } } = useForm<WorkoutPlanForm>({
    resolver: zodResolver(WorkoutPlanSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          days: existing.days.map((d) => ({
            name: d.name,
            focus: d.focus ?? '',
            exercises: d.exercises.map((e) => ({ name: e.name, sets: String(e.sets), reps: e.reps, rest: String(e.restSec) })),
          })),
        }
      : { title: '', days: [{ name: 'Day 1', focus: 'Full body', exercises: [{ name: '', sets: '3', reps: '10', rest: '90' }] }] },
  });
  const days = useFieldArray({ control, name: 'days' });

  const save = useMutation({
    mutationFn: (payload: WorkoutPlanSubmit) =>
      isTemplate
        ? request('templates.save', { id: templateId, kind, title: payload.title, note, days: payload.days })
        : request('plan.saveWorkout', { clientId, ...payload }),
    onSuccess: onSaved,
    onError: handleWriteError,
  });

  const onSubmit = (data: WorkoutPlanForm) => {
    save.mutate({
      title: data.title.trim(),
      days: data.days.map((d) => ({
        name: d.name.trim(),
        focus: d.focus.trim(),
        exercises: d.exercises.map((e) => ({
          name: e.name.trim(), sets: Number(e.sets), reps: e.reps.trim(), restSec: Number(e.rest),
        })),
      })),
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar
          title={isTemplate ? 'Workout template' : 'Workout plan'}
          subtitle={isTemplate ? 'Saved to your library for reuse' : `For ${clientName}`}
        />
        {isTemplate ? (
          <Field
            label="When to use this template"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Best for beginners starting strength training"
            multiline
            numberOfLines={2}
          />
        ) : null}
        <Controller control={control} name="title" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Plan title" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Spring Cut — Block 1" />
        )} />

        {days.fields.map((day, di) => (
          <Card key={day.id} style={{ marginBottom: S.md }}>
            <View style={styles.dayHeader}>
              <View style={styles.dayNum}><Text style={styles.dayNumText}>{di + 1}</Text></View>
              <Text style={TYPE.h3}>Training day</Text>
              {days.fields.length > 1 ? (
                <Pressable hitSlop={8} onPress={() => days.remove(di)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </Pressable>
              ) : null}
            </View>
            <Controller control={control} name={`days.${di}.name`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Day name" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Day 1 — Lower body" />
            )} />
            <Controller control={control} name={`days.${di}.focus`} render={({ field: { value, onChange: onChangeText } }) => (
              <Field label="Focus (optional)" value={value} onChangeText={onChangeText} placeholder="e.g. Strength" />
            )} />
            {errors.days?.[di]?.exercises?.message ? (
              <Text style={styles.blockError}>{errors.days[di]!.exercises!.message}</Text>
            ) : null}

            <ExerciseRows control={control} dayIndex={di} />
          </Card>
        ))}

        <Button
          label="Add training day"
          icon="add-outline"
          variant="soft"
          onPress={() => days.append({ name: `Day ${days.fields.length + 1}`, focus: '', exercises: [{ name: '', sets: '3', reps: '10', rest: '90' }] })}
        />
        {errors.days?.message ? <Text style={styles.blockError}>{errors.days.message}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={save.isPending ? 'Saving…' : isTemplate ? 'Save template' : 'Publish plan'}
          loading={save.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </View>
  );
}

/** The numeric shape the backend stores, converted from the string form fields. */
export interface WorkoutPlanSubmit {
  title: string;
  days: { name: string; focus: string; exercises: { name: string; sets: number; reps: string; restSec: number }[] }[];
}

function ExerciseRows({ control, dayIndex }: { control: Control<WorkoutPlanForm>; dayIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `days.${dayIndex}.exercises` });
  return (
    <>
      {fields.map((ex, ei) => (
        <View key={ex.id} style={styles.exCard}>
          <View style={styles.rowHead}>
            <Text style={styles.indexLabel}>EXERCISE {ei + 1}</Text>
            {fields.length > 1 ? (
              <Pressable hitSlop={8} onPress={() => remove(ei)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="trash-outline" size={16} color={C.danger} />
              </Pressable>
            ) : null}
          </View>
          <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.name`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Exercise" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Back squat" />
          )} />
          <View style={{ flexDirection: 'row' }}>
            <View style={styles.col3Left}>
              <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.sets`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Sets" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
            <View style={styles.col3Left}>
              <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.reps`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Reps" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="8–12" />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.rest`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Rest (s)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
          </View>
        </View>
      ))}
      <Pressable onPress={() => append({ name: '', sets: '3', reps: '10', rest: '90' })} style={styles.addBtn}>
        <Ionicons name="add" size={16} color={C.primary} />
        <Text style={styles.addLabel}>Add exercise</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingBottom: 120 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md },
  dayNum: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: S.sm },
  dayNumText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  removeBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  exCard: { backgroundColor: C.bg, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  indexLabel: { fontSize: 10.5, fontWeight: '800', color: C.faint, letterSpacing: 0.5 },
  col3Left: { flex: 1, marginRight: S.sm },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
    borderRadius: R.sm, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', marginTop: S.xs,
  },
  addLabel: { color: C.primary, fontWeight: '700', fontSize: 13, marginLeft: 4 },
  blockError: { color: C.danger, fontSize: 12.5, fontWeight: '600', marginTop: S.sm },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: S.xl, paddingTop: S.md,
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
});
