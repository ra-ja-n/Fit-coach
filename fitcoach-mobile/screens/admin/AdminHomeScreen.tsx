// Admin console (mobile support view): approve coaches, suspend/ban,
// force-logout, payments overview. Admins never edit plans or see card data.
import React from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import type { AdminOverview } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Avatar, Badge, Button, Card, ErrorState, LoadingView, SectionHeader, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { money, timeAgo } from '../../lib/format';

/** The three write actions the admin console can perform, each with its own payload shape. */
type AdminAction =
  | { op: 'admin.decide'; payload: { userId: string; approve: boolean } }
  | { op: 'admin.setSuspended'; payload: { userId: string; suspended: boolean } }
  | { op: 'admin.forceLogout'; payload: { userId: string } };

export default function AdminHomeScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);

  const q = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => request<AdminOverview>('admin.overview'),
  });

  const act = useMutation({
    mutationFn: (action: AdminAction) => request(action.op, action.payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); showToast('Done', 'success'); },
    onError: (e) => handleWriteError(e),
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load admin data." onRetry={() => q.refetch()} /></View>;

  const d = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={d.users}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={C.primary} />}
        contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <TopBar title="Admin console" subtitle="Support & moderation" back={false}
              right={<Button label="Sign out" compact variant="outline" onPress={() => signOut()} />} />

            <View style={{ flexDirection: 'row' }}>
              <StatMini label="Users" value={String(d.stats.users)} />
              <View style={{ width: S.sm }} />
              <StatMini label="Coaches" value={String(d.stats.coaches)} />
              <View style={{ width: S.sm }} />
              <StatMini label="Active subs" value={String(d.stats.activeSubs)} />
              <View style={{ width: S.sm }} />
              <StatMini label="Revenue" value={money(d.stats.revenueCents)} />
            </View>

            <SectionHeader title="Pending coach approvals" />
            {d.pendingCoaches.length === 0 && <Card><Text style={TYPE.sub}>No pending applications. 🎉</Text></Card>}
            {d.pendingCoaches.map((c) => (
              <Card key={c.userId} style={{ marginBottom: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar name={c.name} size={44} />
                  <View style={{ flex: 1, marginLeft: S.md }}>
                    <Text style={TYPE.h3}>{c.name}</Text>
                    <Text style={TYPE.sub}>{c.email}</Text>
                  </View>
                  <Badge label="PENDING" tone="amber" />
                </View>
                <Text style={[TYPE.sub, { marginTop: S.md }]} numberOfLines={2}>{c.bio}</Text>
                <View style={{ flexDirection: 'row', marginTop: S.lg }}>
                  <Button label="Approve" icon="checkmark" compact style={{ flex: 1, marginRight: S.sm }} onPress={() => act.mutate({ op: 'admin.decide', payload: { userId: c.userId, approve: true } })} />
                  <Button label="Reject" icon="close" compact variant="dangerSoft" style={{ flex: 1 }} onPress={() => act.mutate({ op: 'admin.decide', payload: { userId: c.userId, approve: false } })} />
                </View>
              </Card>
            ))}

            <SectionHeader title="Payments (webhook-confirmed)" />
            {d.payments.map((p) => (
              <Card key={p.id} style={{ marginBottom: S.sm, paddingVertical: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.ink }}>{p.clientName} → {p.coachName}</Text>
                    <Text style={TYPE.caption}>{timeAgo(p.createdAt).toUpperCase()}</Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: C.ink, marginRight: S.sm }}>{money(p.amountCents)}</Text>
                  <Badge label={p.status.toUpperCase()} tone={p.status === 'captured' ? 'green' : p.status === 'pending' ? 'amber' : 'red'} />
                </View>
              </Card>
            ))}

            <SectionHeader title="All users" />
          </>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={item.name} size={38} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.ink }}>{item.name}</Text>
                <Text style={TYPE.caption}>{item.email.toUpperCase()}</Text>
              </View>
              <Badge label={item.role.toUpperCase()} tone={item.role === 'admin' ? 'blue' : item.role === 'coach' ? 'green' : 'gray'} />
              {item.suspended && <View style={{ marginLeft: 6 }}><Badge label="SUSPENDED" tone="red" /></View>}
            </View>
            {item.role !== 'admin' && (
              <View style={{ flexDirection: 'row', marginTop: S.md }}>
                <Button label={item.suspended ? 'Unsuspend' : 'Suspend'} compact variant={item.suspended ? 'soft' : 'dangerSoft'}
                  style={{ marginRight: S.sm }}
                  onPress={() => act.mutate({ op: 'admin.setSuspended', payload: { userId: item.id, suspended: !item.suspended } })} />
                <Button label="Force logout" compact variant="outline" icon="log-out-outline"
                  onPress={() => act.mutate({ op: 'admin.forceLogout', payload: { userId: item.id } })} />
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.lineSoft, padding: S.md, alignItems: 'center' }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }} numberOfLines={1}>{value}</Text>
      <Text style={[TYPE.caption, { marginTop: 2 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}
