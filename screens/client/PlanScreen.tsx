// Client plan viewer — read-only content from the coach, plus gamified
// check-offs: tick exercises/meals as you complete them, earn badges.
// Check-offs are writes → require an ACTIVE subscription (read-only after expiry).
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { DietMeal, PlansBundle, SubscriptionRow, WorkoutDay } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Badge, Card, CelebrationModal, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import { fmtDate } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Celebration = { emoji: string; title: string; subtitle: string };

export default function PlanScreen({ route }: NativeStackScreenProps<ClientStackParamList, 'Plan'>) {
  const { kind, coachId } = route.params;
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const q = useQuery({
    queryKey: ['plans', coachId, me.id],
    queryFn: () => request<PlansBundle>('plans.get', { coachId }),
  });

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });
  const isActive = (subsQ.data ?? []).some((s) => s.status === 'active' && s.coachId === coachId);

  const workoutToggle = useMutation({
    mutationFn: (p: { day: number; exercise: number }) =>
      request<{ done: boolean; dayComplete: boolean; planComplete: boolean }>('workout.toggle', { coachId, ...p }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['plans', coachId, me.id] });
      if (res.planComplete) {
        setCelebration({ emoji: '🏆', title: 'Plan Champion!', subtitle: 'You completed every single exercise in this program. Your coach will be thrilled — enjoy the win!' });
      } else if (res.dayComplete) {
        setCelebration({ emoji: '💪', title: 'Day crushed!', subtitle: `All exercises for this session are done. Recovery is part of training — see you next session.` });
      }
    },
    onError: (e) => handleWriteError(e),
  });

  const dietToggle = useMutation({
    mutationFn: (p: { meal: number; item: number }) =>
      request<{ done: boolean; dayComplete: boolean }>('diet.toggle', { coachId, ...p }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['plans', coachId, me.id] });
      if (res.dayComplete) {
        setCelebration({ emoji: '🥗', title: 'Clean plate!', subtitle: 'Every meal checked today. Consistency like this is exactly how results are built.' });
      }
    },
    onError: (e) => handleWriteError(e),
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (q.isError) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load this plan." onRetry={() => q.refetch()} /></View>;

  const workout = q.data?.workout ?? null;
  const diet = q.data?.diet ?? null;
  const workoutChecks = q.data?.workoutChecks ?? [];
  const dietChecks = q.data?.dietChecks ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar
          title={kind === 'workout' ? 'Workout plan' : 'Nutrition plan'}
          subtitle={kind === 'workout' ? workout?.title : diet?.title}
        />

        {!isActive && (
          <View style={styles.lockNote}>
            <Ionicons name="lock-closed-outline" size={14} color={'#9A6712'} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#9A6712', flex: 1 }}>
              Read-only — your plan ended. Renew to check off and keep training.
            </Text>
          </View>
        )}

        {kind === 'workout' && workout && (
          <WorkoutView
            workout={workout}
            checks={workoutChecks}
            canCheck={isActive}
            updatedAt={workout.updatedAt}
            onToggle={(day, exercise) => workoutToggle.mutate({ day, exercise })}
          />
        )}

        {kind === 'diet' && diet && (
          <DietView
            diet={diet}
            checks={dietChecks}
            canCheck={isActive}
            updatedAt={diet.updatedAt}
            onToggle={(meal, item) => dietToggle.mutate({ meal, item })}
          />
        )}

        <Text style={[TYPE.caption, { textAlign: 'center', marginTop: S.xl }]}>
          DELIVERED BY YOUR COACH · UPDATED {fmtDate(kind === 'workout' ? (workout?.updatedAt ?? '') : (diet?.updatedAt ?? '')).toUpperCase()}
        </Text>
      </ScrollView>

      <CelebrationModal
        visible={!!celebration}
        emoji={celebration?.emoji ?? '🎉'}
        title={celebration?.title ?? ''}
        subtitle={celebration?.subtitle ?? ''}
        onClose={() => setCelebration(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------- workout ---
function WorkoutView({ workout, checks, canCheck, onToggle }: {
  workout: NonNullable<PlansBundle['workout']>;
  checks: { day: number; exercise: number }[];
  canCheck: boolean;
  updatedAt: string;
  onToggle: (day: number, exercise: number) => void;
}) {
  const isChecked = (d: number, e: number) => checks.some((c) => c.day === d && c.exercise === e);
  const total = workout.days.reduce((a, d) => a + d.exercises.length, 0);
  const done = checks.length;
  const pct = total ? done / total : 0;

  return (
    <>
      {/* Overall progress */}
      <Animated.View entering={FadeInDown.duration(240)}>
        <Card style={{ marginBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={TYPE.h3}>Your progress</Text>
            <Badge label={`${done}/${total} DONE`} tone={done === total && total > 0 ? 'green' : 'blue'} />
          </View>
          <View style={styles.bigBar}>
            <View style={[styles.bigBarFill, { width: `${pct * 100}%` }]} />
          </View>
          <Text style={TYPE.sub}>
            {done === total && total > 0
              ? 'Program complete — champion status 🏆'
              : 'Tick off each exercise as you finish it.'}
          </Text>
        </Card>
      </Animated.View>

      {workout.days.map((day, di) => {
        const dayDone = day.exercises.filter((_, ei) => isChecked(di, ei)).length;
        const dayPct = day.exercises.length ? dayDone / day.exercises.length : 0;
        return (
          <Card key={di} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
              <View style={[styles.dayBadge, dayDone === day.exercises.length && day.exercises.length > 0 && { backgroundColor: C.primary }]}>
                {dayDone === day.exercises.length && day.exercises.length > 0
                  ? <Ionicons name="checkmark" size={16} color="#fff" />
                  : <Text style={[styles.dayBadgeText, dayDone === day.exercises.length && { color: '#fff' }]}>{di + 1}</Text>}
              </View>
              <View style={{ marginLeft: S.md, flex: 1 }}>
                <Text style={TYPE.h3}>{day.name}</Text>
                <Text style={TYPE.sub}>{day.focus}</Text>
              </View>
              <Text style={[TYPE.caption, { color: dayDone === day.exercises.length ? C.primary : C.faint }]}>
                {dayDone}/{day.exercises.length}
              </Text>
            </View>
            <View style={styles.dayBar}><View style={[styles.dayBarFill, { width: `${dayPct * 100}%` }]} /></View>

            {day.exercises.map((ex, ei) => {
              const checked = isChecked(di, ei);
              return (
                <View key={ei} style={[styles.exRow, ei > 0 && { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
                  <CheckBox checked={checked} disabled={!canCheck} onPress={() => onToggle(di, ei)} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={[styles.exName, checked && { textDecorationLine: 'line-through', color: C.faint }]}>{ex.name}</Text>
                  </View>
                  <View style={styles.exMeta}>
                    <Text style={styles.exMetaText}>{ex.sets} × {ex.reps}</Text>
                    <View style={styles.restChip}>
                      <Ionicons name="timer-outline" size={11} color={C.sub} />
                      <Text style={styles.restText}>{ex.restSec}s</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}

// -------------------------------------------------------------------- diet ---
function DietView({ diet, checks, canCheck, onToggle }: {
  diet: NonNullable<PlansBundle['diet']>;
  checks: { meal: number; item: number }[];
  canCheck: boolean;
  updatedAt: string;
  onToggle: (meal: number, item: number) => void;
}) {
  const isChecked = (m: number, i: number) => checks.some((c) => c.meal === m && c.item === i);

  const totals = useMemo(() => {
    let kcal = 0, protein = 0, carbs = 0, fat = 0, count = 0;
    diet.meals.forEach((m) => m.items.forEach((it) => {
      kcal += it.kcal; protein += it.protein ?? 0; carbs += it.carbs ?? 0; fat += it.fat ?? 0; count++;
    }));
    return { kcal, protein, carbs, fat, count };
  }, [diet]);

  const kcalPct = diet.targetKcal ? Math.min(1, totals.kcal / diet.targetKcal) : 0;

  return (
    <>
      {/* Daily nutrition summary */}
      <Animated.View entering={FadeInDown.duration(240)}>
        <Card style={{ marginBottom: S.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={TYPE.h3}>Daily summary</Text>
            <Badge label={`${totals.kcal} / ${diet.targetKcal} KCAL`} tone="green" />
          </View>
          <View style={styles.bigBar}>
            <View style={[styles.bigBarFill, { width: `${kcalPct * 100}%` }]} />
          </View>
          <View style={{ flexDirection: 'row', marginTop: S.md }}>
            <MacroStat label="Protein" value={`${totals.protein}g`} color={C.primary} />
            <MacroStat label="Carbs" value={`${totals.carbs}g`} color={C.blue} />
            <MacroStat label="Fat" value={`${totals.fat}g`} color={C.accent} />
            <MacroStat label="Checked" value={`${checks.length}/${totals.count}`} color={C.ink} />
          </View>
          <Text style={[TYPE.sub, { marginTop: S.md }]}>Tick each food as you eat it to keep score of your day.</Text>
        </Card>
      </Animated.View>

      {diet.meals.map((meal, mi) => {
        const mealKcal = meal.items.reduce((a, i) => a + i.kcal, 0);
        const mealProtein = meal.items.reduce((a, i) => a + (i.protein ?? 0), 0);
        return (
          <Card key={mi} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.h3}>{meal.name}</Text>
                {meal.time ? <Text style={TYPE.sub}>{meal.time}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Badge label={`${mealKcal} kcal`} tone="blue" />
                <Text style={[TYPE.caption, { marginTop: 4 }]}>P {mealProtein}g</Text>
              </View>
            </View>
            {meal.items.map((it, ii) => {
              const checked = isChecked(mi, ii);
              return (
                <View key={ii} style={[styles.exRow, ii > 0 && { borderTopWidth: 1, borderTopColor: C.lineSoft }]}>
                  <CheckBox checked={checked} disabled={!canCheck} onPress={() => onToggle(mi, ii)} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={[styles.exName, checked && { textDecorationLine: 'line-through', color: C.faint }]}>{it.food}</Text>
                    <Text style={TYPE.sub}>{it.qty}</Text>
                    <View style={{ flexDirection: 'row', marginTop: 5 }}>
                      <MacroChip label={`P ${it.protein ?? 0}g`} color={C.primary} />
                      <MacroChip label={`C ${it.carbs ?? 0}g`} color={C.blue} />
                      <MacroChip label={`F ${it.fat ?? 0}g`} color={C.accent} />
                    </View>
                  </View>
                  <Text style={styles.kcalText}>{it.kcal}</Text>
                </View>
              );
            })}
          </Card>
        );
      })}

      {diet.notes ? (
        <View style={styles.notesBox}>
          <Ionicons name="bulb-outline" size={16} color={'#9A6712'} style={{ marginRight: 8, marginTop: 2 }} />
          <Text style={{ fontSize: 13.5, lineHeight: 19, color: '#6B4A0E', flex: 1, fontWeight: '500' }}>{diet.notes}</Text>
        </View>
      ) : null}
    </>
  );
}

// -------------------------------------------------------------- primitives ---
function CheckBox({ checked, disabled, onPress }: { checked: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.checkbox, checked && styles.checkboxOn, disabled && { opacity: 0.5 }]}
    >
      {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
    </Pressable>
  );
}

function MacroStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color }}>{value}</Text>
      <Text style={[TYPE.caption, { marginTop: 2 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function MacroChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: `${color}18`, borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 2, marginRight: 5 }}>
      <Text style={{ fontSize: 10.5, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, marginBottom: S.lg },
  bigBar: { height: 8, borderRadius: 4, backgroundColor: C.surfaceAlt, overflow: 'hidden', marginTop: S.md, marginBottom: S.sm },
  bigBarFill: { height: 8, borderRadius: 4, backgroundColor: C.primary },
  dayBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText: { color: C.primaryDark, fontWeight: '800', fontSize: 14 },
  dayBar: { height: 4, borderRadius: 2, backgroundColor: C.surfaceAlt, overflow: 'hidden', marginBottom: S.sm },
  dayBarFill: { height: 4, borderRadius: 2, backgroundColor: C.primary },
  exRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  exName: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  exMeta: { alignItems: 'flex-end' },
  exMetaText: { fontSize: 13.5, fontWeight: '700', color: C.primary },
  restChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  restText: { fontSize: 10.5, fontWeight: '700', color: C.sub, marginLeft: 3 },
  kcalText: { fontSize: 14, fontWeight: '800', color: C.blue, marginLeft: S.sm },
  notesBox: { flexDirection: 'row', backgroundColor: C.accentSoft, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: '#F0DFBC' },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.line, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
});
