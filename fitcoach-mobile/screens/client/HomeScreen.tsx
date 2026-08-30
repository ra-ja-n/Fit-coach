// Client home = their ONE coach's dashboard. No hunting through menus.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { CoachProfile, Package, PlansBundle, ProgressEntry, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, Badge, Button, Card, ErrorState, LoadingView, SectionHeader } from '../../components/ui';
import { C, R, S, TYPE, SHADOW } from '../../theme/tokens';
import { daysLeft, firstName, fmtDate, timeAgo } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });

  const subs = subsQ.data ?? [];
  const active = subs.find((s) => s.status === 'active') ?? null;
  const latest = subs[0] ?? null;
  const pair = active ?? latest;

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

  if (subsQ.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (subsQ.isError) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load your dashboard." onRetry={() => subsQ.refetch()} /></View>;

  const dl = active ? daysLeft(active.endDate) : 0;
  const pct = active && active.endDate ? Math.max(0, Math.min(1, dl / 84)) : 0;
  const latestEntry = progressQ.data?.[0];
  const firstNameClient = firstName(me.name);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={TYPE.caption}>MY COACHING</Text>
            <Text style={[TYPE.h1, { marginTop: 2 }]}>Hi {firstNameClient} 👋</Text>
          </View>
          <Pressable onPress={() => (nav as any).navigate('Tabs', { screen: 'Profile' })} hitSlop={8}>
            <Avatar name={me.name} size={42} />
          </Pressable>
        </View>

        {/* No subscription at all */}
        {!pair ? (
          <Card style={{ marginTop: S.xl, alignItems: 'center', paddingVertical: 40 }}>
            <View style={styles.emptyIcon}><Ionicons name="fitness-outline" size={28} color={C.primary} /></View>
            <Text style={[TYPE.h2, { marginTop: S.md, textAlign: 'center' }]}>Find your coach</Text>
            <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.xs, lineHeight: 20 }]}>
              Browse verified coaches, pick a plan and start your transformation.
            </Text>
            <Button label="Browse coaches" icon="search-outline" style={{ marginTop: S.xl }} onPress={() => nav.navigate('Browse')} />
          </Card>
        ) : (
          <>
            {/* Expired banner */}
            {!active && (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.renewCard}>
                <Ionicons name="hourglass-outline" size={20} color={'#9A6712'} />
                <Text style={styles.renewText}>
                  Your plan with {pair.coachName} ended {fmtDate(pair.endDate)}. Plans & history stay readable — renew to restore messaging and updates.
                </Text>
                <Button label="Renew" compact style={{ alignSelf: 'flex-start', marginTop: S.md }} onPress={() => nav.navigate('CoachDetail', { coachId: pair.coachId })} />
              </Animated.View>
            )}

            {/* Coach card */}
            {coachQ.data && (
              <Card style={{ marginTop: !active ? S.lg : S.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={coachQ.data.profile.name} size={52} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={TYPE.caption}>{active ? 'YOUR COACH' : 'FORMER COACH'}</Text>
                    <Text style={[TYPE.h3, { marginTop: 1 }]}>{coachQ.data.profile.name}</Text>
                    <Text style={TYPE.sub} numberOfLines={1}>{coachQ.data.profile.specialties.join(' · ')}</Text>
                  </View>
                  {active ? <Badge label="ACTIVE" tone="green" /> : <Badge label="READ-ONLY" tone="amber" />}
                </View>

                {active && (
                  <View style={{ marginTop: S.lg }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={TYPE.caption}>{pair.packageTitle.toUpperCase()}</Text>
                      <Text style={[TYPE.caption, { color: dl <= 5 ? '#9A6712' : C.faint }]}>{dl} DAYS LEFT</Text>
                    </View>
                    <View style={styles.bar}><View style={[styles.barFill, { width: `${pct * 100}%` }]} /></View>
                    {dl <= 5 && (
                      <Pressable onPress={() => nav.navigate('CoachDetail', { coachId: pair.coachId })} style={styles.renewInline}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#9A6712' }}>Ending soon — renew now →</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <View style={{ flexDirection: 'row', marginTop: S.lg }}>
                  <Button
                    label={active ? 'Message' : 'Messaging locked'}
                    icon={active ? 'chatbubble-outline' : 'lock-closed-outline'}
                    variant={active ? 'primary' : 'soft'}
                    compact
                    style={{ flex: 1, marginRight: S.sm }}
                    onPress={() =>
                      active
                        ? nav.navigate('Chat', { coachId: pair.coachId, clientId: me.id, name: pair.coachName })
                        : nav.navigate('CoachDetail', { coachId: pair.coachId })
                    }
                  />
                  <Button label="View profile" variant="outline" compact style={{ flex: 1 }} onPress={() => nav.navigate('CoachDetail', { coachId: pair.coachId })} />
                </View>
              </Card>
            )}

            {/* Plans */}
            <SectionHeader title="Your plans" />
            {plansQ.isLoading ? (
              <LoadingView label="Loading plans…" />
            ) : (
              <>
                <PlanRow
                  icon="barbell-outline"
                  title={plansQ.data?.workout?.title}
                  emptyLabel="No workout plan yet"
                  emptyBody={active ? 'Your coach is preparing it.' : 'Your coach never published one.'}
                  sub={plansQ.data?.workout ? `${plansQ.data.workout.days.length} days · updated ${timeAgo(plansQ.data.workout.updatedAt)}` : undefined}
                  onPress={() => plansQ.data?.workout && nav.navigate('Plan', { kind: 'workout', coachId: pair.coachId })}
                />
                <PlanRow
                  icon="nutrition-outline"
                  title={plansQ.data?.diet?.title}
                  emptyLabel="No nutrition plan yet"
                  emptyBody={active ? 'Your coach is preparing it.' : 'Your coach never published one.'}
                  sub={plansQ.data?.diet ? `${plansQ.data.diet.targetKcal} kcal target · updated ${timeAgo(plansQ.data.diet.updatedAt)}` : undefined}
                  onPress={() => plansQ.data?.diet && nav.navigate('Plan', { kind: 'diet', coachId: pair.coachId })}
                />
              </>
            )}

            {/* Progress teaser */}
            <SectionHeader title="Progress" action="Open tracker" onAction={() => (nav as any).navigate('Tabs', { screen: 'Progress' })} />
            <Card onPress={() => (nav as any).navigate('Tabs', { screen: 'Progress' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.planIcon, { backgroundColor: C.blueSoft }]}><Ionicons name="trending-up" size={19} color={C.blue} /></View>
                <View style={{ flex: 1, marginLeft: S.md }}>
                  <Text style={TYPE.h3}>{latestEntry?.weightKg ? `${latestEntry.weightKg} kg` : 'No entries yet'}</Text>
                  <Text style={TYPE.sub}>{latestEntry ? `Last check-in ${timeAgo(latestEntry.createdAt)}` : 'Log today to start your trend'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PlanRow({ icon, title, sub, emptyLabel, emptyBody, onPress }: { icon: any; title?: string; sub?: string; emptyLabel: string; emptyBody: string; onPress?: () => void }) {
  return (
    <Card style={{ marginBottom: S.md }} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.planIcon}><Ionicons name={icon} size={19} color={C.primary} /></View>
        <View style={{ flex: 1, marginLeft: S.md }}>
          <Text style={[TYPE.h3, !title && { color: C.sub }]}>{title ?? emptyLabel}</Text>
          <Text style={TYPE.sub}>{title ? sub : emptyBody}</Text>
        </View>
        {title ? <Ionicons name="chevron-forward" size={18} color={C.faint} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  renewCard: { backgroundColor: C.accentSoft, borderRadius: R.lg, padding: S.lg, marginTop: S.xl, borderWidth: 1, borderColor: '#F0DFBC' },
  renewText: { fontSize: 13.5, lineHeight: 19, color: '#6B4A0E', fontWeight: '600', marginTop: S.sm },
  renewInline: { marginTop: S.sm },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: C.primary },
  planIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
