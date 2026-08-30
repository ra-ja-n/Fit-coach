// Client plan viewer — read-only content from the coach, plus gamified
// check-offs: tick exercises/meals as you complete them, earn badges.
// Check-offs are writes → require an ACTIVE subscription (read-only after expiry).
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import type { PlansBundle, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { CelebrationModal, ErrorState, LoadingView, LockedNotice, TopBar } from '../../components/ui';
import { ClientDietView, ClientWorkoutView } from '../../components/plan';
import { C, S, TYPE } from '../../theme/tokens';
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

  const celebrate = (c: Celebration) => {
    qc.invalidateQueries({ queryKey: ['plans', coachId, me.id] });
    setCelebration(c);
  };

  const workoutToggle = useMutation({
    mutationFn: (p: { day: number; exercise: number }) =>
      request<{ done: boolean; dayComplete: boolean; planComplete: boolean }>('workout.toggle', { coachId, ...p }),
    onSuccess: (res) => {
      if (res.planComplete) {
        celebrate({ emoji: '🏆', title: 'Plan Champion!', subtitle: 'You completed every single exercise in this program. Your coach will be thrilled — enjoy the win!' });
      } else if (res.dayComplete) {
        celebrate({ emoji: '💪', title: 'Day crushed!', subtitle: 'All exercises for this session are done. Recovery is part of training — see you next session.' });
      } else {
        qc.invalidateQueries({ queryKey: ['plans', coachId, me.id] });
      }
    },
    onError: handleWriteError,
  });

  const dietToggle = useMutation({
    mutationFn: (p: { meal: number; item: number }) =>
      request<{ done: boolean; dayComplete: boolean }>('diet.toggle', { coachId, ...p }),
    onSuccess: (res) => {
      if (res.dayComplete) {
        celebrate({ emoji: '🥗', title: 'Clean plate!', subtitle: 'Every meal checked today. Consistency like this is exactly how results are built.' });
      } else {
        qc.invalidateQueries({ queryKey: ['plans', coachId, me.id] });
      }
    },
    onError: handleWriteError,
  });

  if (q.isLoading) return <View style={styles.full}><LoadingView /></View>;
  if (q.isError) return <View style={styles.full}><ErrorState message="Could not load this plan." onRetry={() => q.refetch()} /></View>;

  const workout = q.data?.workout ?? null;
  const diet = q.data?.diet ?? null;
  const workoutChecks = q.data?.workoutChecks ?? [];
  const dietChecks = q.data?.dietChecks ?? [];
  const updatedAt = kind === 'workout' ? workout?.updatedAt ?? '' : diet?.updatedAt ?? '';

  return (
    <View style={styles.full}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar
          title={kind === 'workout' ? 'Workout plan' : 'Nutrition plan'}
          subtitle={kind === 'workout' ? workout?.title : diet?.title}
        />

        {!isActive ? (
          <LockedNotice
            text="Read-only — your plan ended. Renew to check off and keep training."
            style={{ marginBottom: S.lg }}
          />
        ) : null}

        {kind === 'workout' && workout ? (
          <ClientWorkoutView
            workout={workout}
            checks={workoutChecks}
            canCheck={isActive}
            onToggle={(day, exercise) => workoutToggle.mutate({ day, exercise })}
          />
        ) : null}

        {kind === 'diet' && diet ? (
          <ClientDietView
            diet={diet}
            checks={dietChecks}
            canCheck={isActive}
            onToggle={(meal, item) => dietToggle.mutate({ meal, item })}
          />
        ) : null}

        <Text style={[TYPE.caption, styles.footnote]}>DELIVERED BY YOUR COACH · UPDATED {fmtDate(updatedAt).toUpperCase()}</Text>
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

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingBottom: 48 },
  footnote: { textAlign: 'center', marginTop: S.xl },
});
