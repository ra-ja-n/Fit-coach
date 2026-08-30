// Coach-side nutrition plan editor — live plan or library template.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Controller, useFieldArray, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { DietPlan } from '../../lib/api/types';
import { DietPlanSchema, type DietPlanForm } from '../../lib/validation';
import { Button, Card, Field, TopBar } from '../ui';
import { C, R, S, TYPE } from '../../theme/tokens';

export interface DietPlanFormProps {
  kind: 'workout' | 'diet';
  isTemplate: boolean;
  templateId?: string;
  initialNote: string;
  clientId?: string;
  clientName?: string;
  existing: DietPlan | null;
  onSaved: () => void;
}

/** The numeric shape the backend stores, converted from the string form fields. */
export interface DietPlanSubmit {
  title: string;
  targetKcal: number;
  notes: string;
  meals: {
    name: string;
    time: string;
    items: { food: string; qty: string; kcal: number; protein: number; carbs: number; fat: number }[];
  }[];
}

export function DietPlanForm({ kind, isTemplate, templateId, initialNote, clientId, clientName, existing, onSaved }: DietPlanFormProps) {
  const [note, setNote] = useState(initialNote);
  const { control, handleSubmit, formState: { errors } } = useForm<DietPlanForm>({
    resolver: zodResolver(DietPlanSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          targetKcal: String(existing.targetKcal),
          notes: existing.notes,
          meals: existing.meals.map((m) => ({
            name: m.name,
            time: m.time,
            items: m.items.map((i) => ({
              food: i.food, qty: i.qty, kcal: String(i.kcal),
              protein: String(i.protein ?? 0), carbs: String(i.carbs ?? 0), fat: String(i.fat ?? 0),
            })),
          })),
        }
      : { title: '', targetKcal: '2200', notes: '', meals: [{ name: 'Breakfast', time: '08:00', items: [{ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' }] }] },
  });
  const meals = useFieldArray({ control, name: 'meals' });

  const save = useMutation({
    mutationFn: (payload: DietPlanSubmit) =>
      isTemplate
        ? request('templates.save', {
            id: templateId, kind, title: payload.title, note,
            diet: { targetKcal: payload.targetKcal, meals: payload.meals, notes: payload.notes },
          })
        : request('plan.saveDiet', { clientId, ...payload }),
    onSuccess: onSaved,
    onError: handleWriteError,
  });

  const onSubmit = (data: DietPlanForm) => {
    save.mutate({
      title: data.title.trim(),
      targetKcal: Number(data.targetKcal),
      notes: data.notes.trim(),
      meals: data.meals.map((m) => ({
        name: m.name.trim(),
        time: m.time.trim(),
        items: m.items.map((i) => ({
          food: i.food.trim(), qty: i.qty.trim(), kcal: Number(i.kcal),
          protein: Number(i.protein || 0), carbs: Number(i.carbs || 0), fat: Number(i.fat || 0),
        })),
      })),
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar
          title={isTemplate ? 'Nutrition template' : 'Nutrition plan'}
          subtitle={isTemplate ? 'Saved to your library for reuse' : `For ${clientName}`}
        />
        {isTemplate ? (
          <Field
            label="When to use this template"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Cutting plan for clients dropping body fat"
            multiline
            numberOfLines={2}
          />
        ) : null}
        <Controller control={control} name="title" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Plan title" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Lean rebuild — 2,400 kcal" />
        )} />
        <Controller control={control} name="targetKcal" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Daily target (kcal)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
        )} />

        {meals.fields.map((meal, mi) => (
          <Card key={meal.id} style={{ marginBottom: S.md }}>
            <View style={styles.dayHeader}>
              <Text style={TYPE.h3}>Meal {mi + 1}</Text>
              {meals.fields.length > 1 ? (
                <Pressable hitSlop={8} onPress={() => meals.remove(mi)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={styles.nameCol}>
                <Controller control={control} name={`meals.${mi}.name`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                  <Field label="Meal name" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Lunch" />
                )} />
              </View>
              <View style={{ flex: 1 }}>
                <Controller control={control} name={`meals.${mi}.time`} render={({ field: { value, onChange: onChangeText } }) => (
                  <Field label="Time" value={value} onChangeText={onChangeText} placeholder="12:30" />
                )} />
              </View>
            </View>
            <MealItems control={control} mealIndex={mi} />
          </Card>
        ))}

        <Button
          label="Add meal"
          icon="add-outline"
          variant="soft"
          onPress={() => meals.append({ name: '', time: '', items: [{ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' }] })}
        />
        {errors.meals?.message ? <Text style={styles.blockError}>{errors.meals.message}</Text> : null}

        <View style={{ marginTop: S.lg }}>
          <Controller control={control} name="notes" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Coach notes" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Hydration, rest-day adjustments…" multiline numberOfLines={3} />
          )} />
        </View>
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

function MealItems({ control, mealIndex }: { control: Control<DietPlanForm>; mealIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `meals.${mealIndex}.items` });
  const cell = (label: string, name: string, placeholder?: string, numeric?: boolean, flex = 1, marginRight = true) => (
    <View key={name} style={{ flex, marginRight: marginRight ? S.sm : 0 }}>
      <Controller control={control} name={name as `meals.${number}.items.${number}.food`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label={label} value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder={placeholder} keyboardType={numeric ? 'number-pad' : 'default'} />
      )} />
    </View>
  );

  return (
    <>
      {fields.map((item, ii) => {
        const base = `meals.${mealIndex}.items.${ii}` as const;
        return (
          <View key={item.id} style={styles.foodCard}>
            <View style={styles.rowHead}>
              <Text style={styles.indexLabel}>FOOD {ii + 1}</Text>
              {fields.length > 1 ? (
                <Pressable hitSlop={8} onPress={() => remove(ii)} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="trash-outline" size={15} color={C.danger} />
                </Pressable>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {cell('Food', `${base}.food`, 'Chicken breast', false, 1.6)}
              {cell('Qty', `${base}.qty`, '180g', false, 1, false)}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {cell('kcal', `${base}.kcal`, undefined, true)}
              {cell('Protein (g)', `${base}.protein`, undefined, true, 1, false)}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {cell('Carbs (g)', `${base}.carbs`, undefined, true)}
              {cell('Fat (g)', `${base}.fat`, undefined, true, 1, false)}
            </View>
          </View>
        );
      })}
      <Pressable onPress={() => append({ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' })} style={styles.addBtn}>
        <Ionicons name="add" size={16} color={C.primary} />
        <Text style={styles.addLabel}>Add food</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingBottom: 120 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md },
  removeBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  nameCol: { flex: 1.4, marginRight: S.sm },
  foodCard: { backgroundColor: C.bg, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  indexLabel: { fontSize: 10.5, fontWeight: '800', color: C.faint, letterSpacing: 0.5 },
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
