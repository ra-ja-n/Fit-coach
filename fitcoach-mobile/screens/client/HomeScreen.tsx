// Client home = their ONE coach's dashboard. No hunting through menus.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { CoachProfile, Package, PlansBundle, ProgressEntry, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, Button, Card, ErrorState, LoadingView, SectionHeader } from '../../components/ui';
import { PlanSummaryRow } from '../../components/plan';
import { ProgressTeaserRow } from '../../components/progress';
import { CoachSummaryCard, RenewNotice } from '../../components/subscription';
import { C, S, TYPE } from '../../theme/tokens';
import { daysLeft, firstName, timeAgo } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

/** The trend bar assumes a ~12-week coaching block. */
const PLAN_LENGTH_DAYS = 84;

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;

  const subsQ = useQuery({ queryKey: ['subs', 'mine'], queryFn: () => request<SubscriptionRow[]>('subs.mine') });
  const subs = subsQ.data ?? [];
  const active = subs.find((s) => s.status === 'active') ?? null;
  const pair = active ?? subs[0] ?? null;

  const coachQ = useQuery({
    queryKey: ['coach', pair?.coachId],
    queryFn: () => request<{ profile: CoachProfile; packages: Package[] }>('coach.getPublic', { coachId: pair!.coachId }),
    enabled: !!pair,
  });
  const plansQ = useQuery({
    queryKey: ['plans', pair?.coachId, me.id],
    queryFn: () => request<PlansBundle>('plans.get', { coachId: pair!.coachId }),
    enabled: !!pair,
  });
  const progressQ = useQuery({
    queryKey: ['progress', 'mine', pair?.coachId],
    queryFn: () => request<ProgressEntry[]>('progress.mine', { coachId: pair!.coachId }),
    enabled: !!pair,
  });

  if (subsQ.isLoading) return <View style={styles.full}><LoadingView /></View>;
  if (subsQ.isError) return <View style={styles.full}><ErrorState message="Could not load your dashboard." onRetry={() => subsQ.refetch()} /></View>;

  const remaining = active ? daysLeft(active.endDate) : 0;
  const workout = plansQ.data?.workout;
  const diet = plansQ.data?.diet;
  const emptyBody = active ? 'Your coach is preparing it.' : 'Your coach never published one.';

  return (
    <View style={styles.full}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={TYPE.caption}>MY COACHING</Text>
            <Text style={[TYPE.h1, { marginTop: 2 }]}>Hi {firstName(me.name)} 👋</Text>
          </View>
          <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Profile' })} hitSlop={8}>
            <Avatar name={me.name} size={42} />
          </Pressable>
        </View>

        {!pair ? (
          <Card style={styles.findCoach}>
            <View style={styles.findCoachIcon}><Ionicons name="fitness-outline" size={28} color={C.primary} /></View>
            <Text style={[TYPE.h2, { marginTop: S.md, textAlign: 'center' }]}>Find your coach</Text>
            <Text style={styles.findCoachBody}>Browse verified coaches, pick a plan and start your transformation.</Text>
            <Button label="Browse coaches" icon="search-outline" style={{ marginTop: S.xl }} onPress={() => nav.navigate('Browse')} />
          </Card>
        ) : (
          <>
            {!active && (
              <RenewNotice
                coachName={pair.coachName}
                endDate={pair.endDate}
                onRenew={() => nav.navigate('CoachDetail', { coachId: pair.coachId })}
              />
            )}

            {coachQ.data && (
              <CoachSummaryCard
                coachName={coachQ.data.profile.name}
                specialties={coachQ.data.profile.specialties}
                packageTitle={pair.packageTitle}
                daysLeft={remaining}
                progress={active ? Math.max(0, Math.min(1, remaining / PLAN_LENGTH_DAYS)) : 0}
                active={!!active}
                onMessage={() =>
                  active
                    ? nav.navigate('Chat', { coachId: pair.coachId, clientId: me.id, name: pair.coachName })
                    : nav.navigate('CoachDetail', { coachId: pair.coachId })
                }
                onViewProfile={() => nav.navigate('CoachDetail', { coachId: pair.coachId })}
              />
            )}

            <SectionHeader title="Your plans" />
            {plansQ.isLoading ? (
              <LoadingView label="Loading plans…" />
            ) : (
              <>
                <PlanSummaryRow
                  icon="barbell-outline"
                  title={workout?.title}
                  sub={workout ? `${workout.days.length} days · updated ${timeAgo(workout.updatedAt)}` : undefined}
                  emptyLabel="No workout plan yet"
                  emptyBody={emptyBody}
                  onPress={() => nav.navigate('Plan', { kind: 'workout', coachId: pair.coachId })}
                />
                <PlanSummaryRow
                  icon="nutrition-outline"
                  title={diet?.title}
                  sub={diet ? `${diet.targetKcal} kcal target · updated ${timeAgo(diet.updatedAt)}` : undefined}
                  emptyLabel="No nutrition plan yet"
                  emptyBody={emptyBody}
                  onPress={() => nav.navigate('Plan', { kind: 'diet', coachId: pair.coachId })}
                />
              </>
            )}

            <SectionHeader title="Progress" action="Open tracker" onAction={() => nav.navigate('Tabs', { screen: 'Progress' })} />
            <ProgressTeaserRow latest={progressQ.data?.[0]} onPress={() => nav.navigate('Tabs', { screen: 'Progress' })} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  findCoach: { marginTop: S.xl, alignItems: 'center', paddingVertical: 40 },
  findCoachIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  findCoachBody: { ...TYPE.sub, textAlign: 'center', marginTop: S.xs, lineHeight: 20 },
});
