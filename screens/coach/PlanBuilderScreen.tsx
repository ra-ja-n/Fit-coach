// Plan builder — coach creates/edits workout & diet plans (JSON content),
// either for a specific client or as a reusable library TEMPLATE that can be
// assigned to any client later. Client saves require an active subscription
// (enforced server-side); template saves never touch client data.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { PlanTemplate, PlansBundle } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { DietPlanSchema, WorkoutPlanSchema, type DietPlanForm, type WorkoutPlanForm } from '../../lib/validation';
import { Button, Card, Field, LoadingView, TopBar } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import type { CoachStackParamList } from '../../navigation/types';

export default function PlanBuilderScreen({ route, navigation }: NativeStackScreenProps<CoachStackParamList, 'PlanBuilder'>) {
  const { clientId, kind, clientName, mode, templateId } = route.params;
  const isTemplate = mode === 'template';
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const plansQ = useQuery({
    queryKey: ['plans', me.id, clientId],
    queryFn: () => request<PlansBundle>('plans.get', { coachId: me.id, clientId }),
    enabled: !isTemplate && !!clientId,
  });

  const templatesQ = useQuery({
    queryKey: ['templates'],
    queryFn: () => request<PlanTemplate[]>('templates.list'),
    enabled: isTemplate,
  });

  if (isTemplate ? templatesQ.isLoading : plansQ.isLoading) {
    return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView label="Loading…" /></View>;
  }

  const template: PlanTemplate | null = isTemplate
    ? templatesQ.data?.find((t) => t.id === templateId) ?? null
    : null;

  const afterSave = (msg: string) => {
    qc.invalidateQueries({ queryKey: ['plans'] });
    qc.invalidateQueries({ queryKey: ['coach'] });
    qc.invalidateQueries({ queryKey: ['templates'] });
    showToast(msg, 'success');
    navigation.goBack();
  };

  const common = {
    isTemplate,
    templateId: template?.id,
    initialNote: template?.note ?? '',
    kind,
  };

  return kind === 'workout' ? (
    <WorkoutBuilder
      {...common}
      clientId={clientId}
      clientName={clientName}
      existing={isTemplate
        ? (template?.days ? { title: template.title, days: template.days } : null)
        : (plansQ.data?.workout ?? null)}
      onSaved={() => afterSave(isTemplate ? 'Template saved to your library' : 'Workout plan published — your client can see it now')}
    />
  ) : (
    <DietBuilder
      {...common}
      clientId={clientId}
      clientName={clientName}
      existing={isTemplate
        ? (template?.diet ? { title: template.title, targetKcal: template.diet.targetKcal, meals: template.diet.meals, notes: template.diet.notes, id: '', coachId: '', clientId: '', updatedAt: '' } : null)
        : (plansQ.data?.diet ?? null)}
      onSaved={() => afterSave(isTemplate ? 'Template saved to your library' : 'Nutrition plan published — your client can see it now')}
    />
  );
}

// ---------------------------------------------------------------- workout ---
function WorkoutBuilder({ clientId, clientName, existing, onSaved, isTemplate, templateId, initialNote, kind }: {
  clientId?: string; clientName?: string; existing: PlansBundle['workout'] | { days: any[]; title: string } | null;
  onSaved: () => void; isTemplate: boolean; templateId?: string; initialNote: string; kind: 'workout' | 'diet';
}) {
  const [note, setNote] = useState(initialNote);
  const src: any = existing;
  const { control, handleSubmit, formState: { errors } } = useForm<WorkoutPlanForm>({
    resolver: zodResolver(WorkoutPlanSchema),
    defaultValues: src
      ? { title: src.title, days: src.days.map((d: any) => ({ name: d.name, focus: d.focus ?? '', exercises: d.exercises.map((e: any) => ({ name: e.name, sets: String(e.sets), reps: e.reps, rest: String(e.restSec) })) })) }
      : { title: '', days: [{ name: 'Day 1', focus: 'Full body', exercises: [{ name: '', sets: '3', reps: '10', rest: '90' }] }] },
  });
  const days = useFieldArray({ control, name: 'days' });

  const save = useMutation({
    mutationFn: (payload: any) => isTemplate
      ? request('templates.save', { id: templateId, kind, title: payload.title, note, days: payload.days })
      : request('plan.saveWorkout', { clientId, ...payload }),
    onSuccess: onSaved,
    onError: (e) => handleWriteError(e),
  });

  const onSubmit = (data: WorkoutPlanForm) => {
    save.mutate({
      title: data.title.trim(),
      days: data.days.map((d) => ({
        name: d.name.trim(), focus: d.focus.trim(),
        exercises: d.exercises.map((e) => ({ name: e.name.trim(), sets: Number(e.sets), reps: e.reps.trim(), restSec: Number(e.rest) })),
      })),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar title={isTemplate ? 'Workout template' : 'Workout plan'} subtitle={isTemplate ? 'Saved to your library for reuse' : `For ${clientName}`} />
        {isTemplate && (
          <Field label="When to use this template" value={note} onChangeText={setNote} placeholder="e.g. Best for beginners starting strength training" multiline numberOfLines={2} />
        )}
        <Controller control={control} name="title" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Plan title" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Spring Cut — Block 1" />
        )} />

        {days.fields.map((day, di) => (
          <Card key={day.id} style={{ marginBottom: S.md }}>
            <View style={styles.dayHeader}>
              <View style={styles.dayNum}><Text style={styles.dayNumText}>{di + 1}</Text></View>
              <Text style={TYPE.h3}>Training day</Text>
              {days.fields.length > 1 && (
                <Pressable hitSlop={8} onPress={() => days.remove(di)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </Pressable>
              )}
            </View>
            {errors.days?.[di] && !errors.days[di]?.name && errors.days[di]?.root ? null : null}
            <Controller control={control} name={`days.${di}.name`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Day name" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Day 1 — Lower body" />
            )} />
            <Controller control={control} name={`days.${di}.focus`} render={({ field: { value, onChange: onChangeText } }) => (
              <Field label="Focus (optional)" value={value} onChangeText={onChangeText} placeholder="e.g. Strength" />
            )} />
            {errors.days?.[di]?.exercises?.message ? <Text style={styles.blockError}>{errors.days[di]!.exercises!.message}</Text> : null}

            <ExerciseRows control={control} dayIndex={di} />
          </Card>
        ))}

        <Button label="Add training day" icon="add-outline" variant="soft" onPress={() => days.append({ name: `Day ${days.fields.length + 1}`, focus: '', exercises: [{ name: '', sets: '3', reps: '10', rest: '90' }] })} />
        {errors.days?.message ? <Text style={styles.blockError}>{errors.days.message}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={save.isPending ? 'Saving…' : (isTemplate ? 'Save template' : 'Publish plan')} loading={save.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </View>
  );
}

function ExerciseRows({ control, dayIndex }: { control: any; dayIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `days.${dayIndex}.exercises` });
  return (
    <>
      {fields.map((ex, ei) => (
        <View key={ex.id} style={styles.exCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={styles.exIndex}>EXERCISE {ei + 1}</Text>
            {fields.length > 1 && (
              <Pressable hitSlop={8} onPress={() => remove(ei)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="trash-outline" size={16} color={C.danger} />
              </Pressable>
            )}
          </View>
          <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.name`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Exercise" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. Back squat" />
          )} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: S.sm }}>
              <Controller control={control} name={`days.${dayIndex}.exercises.${ei}.sets`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Sets" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
            <View style={{ flex: 1, marginRight: S.sm }}>
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
      <Pressable onPress={() => append({ name: '', sets: '3', reps: '10', rest: '90' })} style={styles.addEx}>
        <Ionicons name="add" size={16} color={C.primary} />
        <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>Add exercise</Text>
      </Pressable>
    </>
  );
}

// ------------------------------------------------------------------- diet ---
function DietBuilder({ clientId, clientName, existing, onSaved, isTemplate, templateId, initialNote, kind }: {
  clientId?: string; clientName?: string; existing: PlansBundle['diet'] | null; onSaved: () => void;
  isTemplate: boolean; templateId?: string; initialNote: string; kind: 'workout' | 'diet';
}) {
  const [note, setNote] = useState(initialNote);
  const { control, handleSubmit, formState: { errors } } = useForm<DietPlanForm>({
    resolver: zodResolver(DietPlanSchema),
    defaultValues: existing
      ? { title: existing.title, targetKcal: String(existing.targetKcal), notes: existing.notes, meals: existing.meals.map((m) => ({ name: m.name, time: m.time, items: m.items.map((i) => ({ food: i.food, qty: i.qty, kcal: String(i.kcal), protein: String(i.protein ?? 0), carbs: String(i.carbs ?? 0), fat: String(i.fat ?? 0) })) })) }
      : { title: '', targetKcal: '2200', notes: '', meals: [{ name: 'Breakfast', time: '08:00', items: [{ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' }] }] },
  });
  const meals = useFieldArray({ control, name: 'meals' });

  const save = useMutation({
    mutationFn: (payload: any) => isTemplate
      ? request('templates.save', { id: templateId, kind, title: payload.title, note, diet: { targetKcal: payload.targetKcal, meals: payload.meals, notes: payload.notes } })
      : request('plan.saveDiet', { clientId, ...payload }),
    onSuccess: onSaved,
    onError: (e) => handleWriteError(e),
  });

  const onSubmit = (data: DietPlanForm) => {
    save.mutate({
      title: data.title.trim(),
      targetKcal: Number(data.targetKcal),
      notes: data.notes.trim(),
      meals: data.meals.map((m) => ({
        name: m.name.trim(), time: m.time.trim(),
        items: m.items.map((i) => ({
          food: i.food.trim(), qty: i.qty.trim(), kcal: Number(i.kcal),
          protein: Number(i.protein || 0), carbs: Number(i.carbs || 0), fat: Number(i.fat || 0),
        })),
      })),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar title={isTemplate ? 'Nutrition template' : 'Nutrition plan'} subtitle={isTemplate ? 'Saved to your library for reuse' : `For ${clientName}`} />
        {isTemplate && (
          <Field label="When to use this template" value={note} onChangeText={setNote} placeholder="e.g. Cutting plan for clients dropping body fat" multiline numberOfLines={2} />
        )}
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
              {meals.fields.length > 1 && (
                <Pressable hitSlop={8} onPress={() => meals.remove(mi)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1.4, marginRight: S.sm }}>
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

        <Button label="Add meal" icon="add-outline" variant="soft" onPress={() => meals.append({ name: '', time: '', items: [{ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' }] })} />
        {errors.meals?.message ? <Text style={styles.blockError}>{errors.meals.message}</Text> : null}

        <View style={{ marginTop: S.lg }}>
          <Controller control={control} name="notes" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
            <Field label="Coach notes" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Hydration, rest-day adjustments…" multiline numberOfLines={3} />
          )} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={save.isPending ? 'Saving…' : (isTemplate ? 'Save template' : 'Publish plan')} loading={save.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </View>
  );
}

function MealItems({ control, mealIndex }: { control: any; mealIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `meals.${mealIndex}.items` });
  return (
    <>
      {fields.map((item, ii) => (
        <View key={item.id} style={styles.foodCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
            <Text style={styles.exIndex}>FOOD {ii + 1}</Text>
            {fields.length > 1 && (
              <Pressable hitSlop={8} onPress={() => remove(ii)} style={{ marginLeft: 'auto' }}>
                <Ionicons name="trash-outline" size={15} color={C.danger} />
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1.6, marginRight: S.sm }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.food`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Food" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Chicken breast" />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.qty`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Qty" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="180g" />
              )} />
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: S.sm }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.kcal`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="kcal" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
            <View style={{ flex: 1, marginRight: S.sm }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.protein`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Protein (g)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: S.sm }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.carbs`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Carbs (g)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
            <View style={{ flex: 1 }}>
              <Controller control={control} name={`meals.${mealIndex}.items.${ii}.fat`} render={({ field: { value, onChange: onChangeText }, fieldState }) => (
                <Field label="Fat (g)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
              )} />
            </View>
          </View>
        </View>
      ))}
      <Pressable onPress={() => append({ food: '', qty: '', kcal: '0', protein: '0', carbs: '0', fat: '0' })} style={styles.addEx}>
        <Ionicons name="add" size={16} color={C.primary} />
        <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13, marginLeft: 4 }}>Add food</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: S.md },
  dayNum: { width: 28, height: 28, borderRadius: 9, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: S.sm },
  dayNumText: { color: C.primaryDark, fontWeight: '800', fontSize: 13 },
  removeBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 10, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  exCard: { backgroundColor: C.bg, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  foodCard: { backgroundColor: C.bg, borderRadius: R.md, padding: S.md, marginBottom: S.md },
  exIndex: { fontSize: 10.5, fontWeight: '800', color: C.faint, letterSpacing: 0.5 },
  addEx: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: R.sm, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', marginTop: S.xs },
  blockError: { color: C.danger, fontSize: 12.5, fontWeight: '600', marginTop: S.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: S.xl, paddingTop: S.md, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.lineSoft },
});
