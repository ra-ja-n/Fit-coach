// Coach home = client list. Active subscribers only for management; lapsed
// clients appear read-only, never hidden.
import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { CoachClientRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, Badge, Card, EmptyState, ErrorState, LoadingView, SectionHeader } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { firstName, timeAgo } from '../../lib/format';
import type { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList>;

export default function CoachHomeScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;

  const q = useQuery({
    queryKey: ['coach', 'clients'],
    queryFn: () => request<CoachClientRow[]>('coach.clients'),
  });

  const rows = q.data ?? [];
  const active = rows.filter((r) => r.status === 'active');
  const past = rows.filter((r) => r.status !== 'active');

  if (me.coachStatus === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.xl }}>
          <Text style={TYPE.caption}>COACH CONSOLE</Text>
          <Text style={[TYPE.h1, { marginTop: 2 }]}>Hi {firstName(me.name)} 👋</Text>
        </View>
        <EmptyState
          icon="hourglass-outline"
          title="Awaiting approval"
          body="The FitCoach team is reviewing your coach profile. You'll be visible to clients once approved — usually within 24 hours."
        />
      </View>
    );
  }

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (q.isError) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load your clients." onRetry={() => q.refetch()} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={active}
        keyExtractor={(r) => r.clientId}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.primary} />}
        contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={TYPE.caption}>COACH CONSOLE</Text>
                <Text style={[TYPE.h1, { marginTop: 2 }]}>Your clients</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{active.length} ACTIVE</Text>
              </View>
            </View>
            {active.length === 0 && (
              <Card style={{ marginTop: S.xl, alignItems: 'center', paddingVertical: 36 }}>
                <Text style={[TYPE.h3, { textAlign: 'center' }]}>No active subscribers yet</Text>
                <Text style={[TYPE.sub, { textAlign: 'center', marginTop: S.xs, lineHeight: 20 }]}>
                  Share your public coach link. When a client subscribes, they appear here instantly.
                </Text>
              </Card>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).duration(240)}>
            <ClientCard row={item} onPress={() => nav.navigate('ClientDetail', { clientId: item.clientId })} />
          </Animated.View>
        )}
        ListFooterComponent={
          past.length > 0 ? (
            <>
              <SectionHeader title="Past clients · read-only" />
              {past.map((r) => (
                <ClientCard key={r.clientId} row={r} onPress={() => nav.navigate('ClientDetail', { clientId: r.clientId })} muted />
              ))}
            </>
          ) : null
        }
      />
    </View>
  );
}

function ClientCard({ row, onPress, muted }: { row: CoachClientRow; onPress: () => void; muted?: boolean }) {
  const lastActivity = [row.lastMessageAt, row.lastProgressAt].filter(Boolean).sort().pop() ?? null;
  return (
    <Card style={{ marginBottom: S.md, opacity: muted ? 0.75 : 1 }} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={row.clientName} size={48} />
        <View style={{ flex: 1, marginLeft: S.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{row.clientName}</Text>
            {row.unread > 0 && (
              <View style={styles.unread}><Text style={styles.unreadText}>{row.unread}</Text></View>
            )}
          </View>
          <Text style={TYPE.sub} numberOfLines={1}>{row.packageTitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ marginLeft: S.sm }} />
      </View>
      <View style={styles.metaRow}>
        {row.status === 'active' ? (
          <Badge label={`${row.daysLeft} DAYS LEFT`} tone={row.daysLeft <= 5 ? 'amber' : 'green'} />
        ) : (
          <Badge label={row.status.toUpperCase()} tone={row.status === 'cancelled' ? 'red' : 'amber'} />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={row.hasWorkout ? 'barbell' : 'barbell-outline'} size={14} color={row.hasWorkout ? C.primary : C.faint} style={{ marginRight: 6 }} />
          <Ionicons name={row.hasDiet ? 'nutrition' : 'nutrition-outline'} size={14} color={row.hasDiet ? C.primary : C.faint} />
        </View>
      </View>
      {lastActivity && <Text style={[TYPE.caption, { marginTop: S.sm }]}>LAST ACTIVITY {timeAgo(lastActivity).toUpperCase()}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  countPill: { backgroundColor: C.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  countText: { color: C.primaryDark, fontSize: 11.5, fontWeight: '800' },
  unread: { backgroundColor: C.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginRight: 6 },
  unreadText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.lineSoft },
});
