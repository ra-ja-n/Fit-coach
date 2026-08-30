// Coach view of one client: progress overview, plans management (create, edit,
// or assign a pre-made library template), chat. Read-only automatically when
// the subscription lapses.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { ClientDetailBundle, PlanTemplate, PlansBundle, ProgressEntry } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Avatar, Badge, Button, Card, ErrorState, LoadingView, ModalSheet, SectionHeader, StatTile, TopBar } from '../../components/ui';
import { WeightChart } from '../../components/WeightChart';
import { C, R, S, TYPE } from '../../theme/tokens';
import { fmtDate, fmtDay, timeAgo } from '../../lib/format';
import type { CoachStackParamList } from '../../navigation/types';

export default function ClientDetailScreen({ route, navigation }: NativeStackScreenProps<CoachStackParamList, 'ClientDetail'>) {
  const { clientId } = route.params;
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [libraryKind, setLibraryKind] = useState<'workout' | 'diet' | null>(null);

  const detailQ = useQuery({
    queryKey: ['coach', 'clientDetail', clientId],
    queryFn: () => request<ClientDetailBundle>('coach.clientDetail', { clientId }),
  });
  const progressQ = useQuery({
    queryKey: ['progress', 'client', clientId],
    queryFn: () => request<ProgressEntry[]>('progress.client', { clientId }),
    enabled: !!detailQ.data,
  });
  const plansQ = useQuery({
    queryKey: ['plans', me.id, clientId],
    queryFn: () => request<PlansBundle>('plans.get', { coachId: me.id, clientId }),
    enabled: !!detailQ.data,
  });

  const templatesQ = useQuery({
    queryKey: ['templates'],
    queryFn: () => request<PlanTemplate[]>('templates.list'),
    enabled: libraryKind !== null,
  });

  const assignMutation = useMutation({
    mutationFn: (templateId: string) => request('templates.assign', { templateId, clientId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['coach'] });
      setLibraryKind(null);
      showToast('Template assigned — your client sees it instantly', 'success');
    },
    onError: (e) => handleWriteError(e),
  });

  if (detailQ.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (detailQ.isError || !detailQ.data) {
    return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="This client is not in your roster." onRetry={() => detailQ.refetch()} /></View>;
  }

  const d = detailQ.data;
  const isActive = d.status === 'active';
  const entries = progressQ.data ?? [];
  const chrono = [...entries].reverse().filter((e) => e.weightKg != null);
  const current = entries.find((e) => e.weightKg != null)?.weightKg ?? null;
  const first = chrono.length ? chrono[0].weightKg : null;
  const delta = current != null && first != null ? +(current - first).toFixed(1) : null;
  const photos = entries.filter((e) => e.photoUrls.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar
          title={d.clientName}
          subtitle={d.clientEmail}
          right={
            <Button
              label={isActive ? 'Message' : 'Locked'}
              icon={isActive ? 'chatbubble-outline' : 'lock-closed-outline'}
              compact
              variant={isActive ? 'primary' : 'soft'}
              onPress={() => isActive && navigation.navigate('Chat', { coachId: me.id, clientId, name: d.clientName })}
            />
          }
        />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={d.clientName} size={46} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={TYPE.h3}>{d.packageTitle}</Text>
              <Text style={TYPE.sub}>{fmtDate(d.startDate)} → {fmtDate(d.endDate)}</Text>
            </View>
            <Badge label={d.status.toUpperCase()} tone={isActive ? 'green' : d.status === 'cancelled' ? 'red' : 'amber'} />
          </View>
          {!isActive && (
            <View style={styles.readOnlyBar}>
              <Ionicons name="lock-closed-outline" size={13} color={'#9A6712'} style={{ marginRight: 7 }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#9A6712', flex: 1 }}>
                Subscription ended — history is read-only. Messaging and plan updates are disabled.
              </Text>
            </View>
          )}
        </Card>

        {/* Progress summary */}
        <SectionHeader title="Progress" />
        <View style={{ flexDirection: 'row' }}>
          <StatTile label="Start" value={first != null ? `${first} kg` : '—'} />
          <View style={{ width: S.md }} />
          <StatTile label="Current" value={current != null ? `${current} kg` : '—'} />
          <View style={{ width: S.md }} />
          <StatTile label="Change" value={delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'} tone={delta != null ? (delta <= 0 ? 'green' : 'red') : undefined} />
        </View>

        {chrono.length >= 2 && (
          <Card style={{ marginTop: S.md }}>
            <Text style={[TYPE.caption, { marginBottom: S.sm }]}>WEIGHT TREND</Text>
            <WeightChart data={chrono.map((e) => ({ date: e.date, value: e.weightKg! }))} />
          </Card>
        )}

        {entries.length > 0 && (
          <Card style={{ marginTop: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.sm }}>
              <Text style={[TYPE.h3, { flex: 1 }]}>Latest check-in</Text>
              <Text style={TYPE.caption}>{timeAgo(entries[0].createdAt).toUpperCase()}</Text>
            </View>
            <Text style={TYPE.sub}>
              {[entries[0].weightKg ? `${entries[0].weightKg} kg` : null, entries[0].measurements.waist ? `waist ${entries[0].measurements.waist}cm` : null].filter(Boolean).join(' · ') || 'Logged'}
            </Text>
            {entries[0].notes ? <Text style={[TYPE.sub, { marginTop: 6, fontStyle: 'italic' }]}>“{entries[0].notes}”</Text> : null}
          </Card>
        )}

        {/* Weekly photos */}
        {photos.length > 0 && (
          <>
            <SectionHeader title="Weekly photos" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -S.xl }} contentContainerStyle={{ paddingHorizontal: S.xl }}>
              {photos.map((e) => (
                <Pressable key={e.id} onPress={() => navigation.navigate('PhotoView', { uri: e.photoUrls[e.photoUrls.length - 1], label: `${d.clientName} · ${fmtDay(e.date)}` })} style={{ marginRight: S.md }}>
                  <Image source={{ uri: e.photoUrls[e.photoUrls.length - 1] }} style={styles.photo} />
                  <Text style={[TYPE.caption, { marginTop: 6, textAlign: 'center' }]}>{fmtDay(e.date)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Plans */}
        <SectionHeader title="Plans" />
        {(d.workoutTotal > 0 || d.dietTotal > 0) && (
          <View style={styles.adherenceRow}>
            {d.workoutTotal > 0 && (
              <View style={styles.adherenceChip}>
                <Ionicons name="barbell-outline" size={13} color={C.primary} style={{ marginRight: 6 }} />
                <Text style={styles.adherenceText}>Workout {d.workoutChecked}/{d.workoutTotal} checked</Text>
              </View>
            )}
            {d.dietTotal > 0 && (
              <View style={styles.adherenceChip}>
                <Ionicons name="nutrition-outline" size={13} color={C.blue} style={{ marginRight: 6 }} />
                <Text style={styles.adherenceText}>Diet {d.dietChecked}/{d.dietTotal} checked</Text>
              </View>
            )}
          </View>
        )}
        <PlanAdminRow
          icon="barbell-outline"
          title={plansQ.data?.workout?.title}
          emptyLabel="No workout plan yet"
          updated={plansQ.data?.workout?.updatedAt}
          canEdit={isActive}
          onEdit={() => navigation.navigate('PlanBuilder', { clientId, kind: 'workout', clientName: d.clientName })}
          onLibrary={() => setLibraryKind('workout')}
        />
        <PlanAdminRow
          icon="nutrition-outline"
          title={plansQ.data?.diet?.title}
          emptyLabel="No nutrition plan yet"
          updated={plansQ.data?.diet?.updatedAt}
          canEdit={isActive}
          onEdit={() => navigation.navigate('PlanBuilder', { clientId, kind: 'diet', clientName: d.clientName })}
          onLibrary={() => setLibraryKind('diet')}
        />
      </ScrollView>

      {/* Assign from library */}
      <ModalSheet
        visible={libraryKind !== null}
        onClose={() => setLibraryKind(null)}
        title={libraryKind === 'workout' ? 'Assign workout template' : 'Assign nutrition template'}
      >
        {(templatesQ.data ?? []).filter((t) => t.kind === libraryKind).length === 0 && (
          <Text style={[TYPE.sub, { marginBottom: S.md }]}>
            No {libraryKind} templates yet. Create them in Business → Plan library.
          </Text>
        )}
        {(templatesQ.data ?? []).filter((t) => t.kind === libraryKind).map((t) => (
          <Card key={t.id} style={{ marginBottom: S.md }} onPress={() => assignMutation.mutate(t.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.h3}>{t.title}</Text>
                {t.note ? <Text style={[TYPE.sub, { marginTop: 2 }]} numberOfLines={2}>{t.note}</Text> : null}
              </View>
              {assignMutation.isPending ? (
                <Ionicons name="hourglass-outline" size={18} color={C.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={C.faint} />
              )}
            </View>
          </Card>
        ))}
      </ModalSheet>
    </View>
  );
}

function PlanAdminRow({ icon, title, emptyLabel, updated, canEdit, onEdit, onLibrary }: {
  icon: any; title?: string; emptyLabel: string; updated?: string; canEdit: boolean; onEdit: () => void; onLibrary: () => void;
}) {
  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.planIcon}><Ionicons name={icon} size={18} color={C.primary} /></View>
        <View style={{ flex: 1, marginLeft: S.md }}>
          <Text style={[TYPE.h3, !title && { color: C.sub }]}>{title ?? emptyLabel}</Text>
          {updated ? <Text style={TYPE.sub}>Updated {timeAgo(updated)}</Text> : <Text style={TYPE.sub}>Create one or assign from your library</Text>}
        </View>
        {canEdit ? (
          <>
            <Pressable hitSlop={8} onPress={onLibrary} style={styles.libraryBtn}>
              <Ionicons name="library-outline" size={17} color={C.primaryDark} />
            </Pressable>
            <Button label={title ? 'Edit' : 'Create'} compact variant={title ? 'outline' : 'primary'} onPress={onEdit} />
          </>
        ) : (
          <Ionicons name="lock-closed-outline" size={16} color={C.faint} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  readOnlyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 9, marginTop: S.md },
  photo: { width: 100, height: 125, borderRadius: R.md, backgroundColor: C.surfaceAlt },
  planIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  libraryBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: S.sm },
  adherenceRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.md },
  adherenceChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.full, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7, marginRight: S.sm, marginBottom: S.sm },
  adherenceText: { fontSize: 12, fontWeight: '700', color: C.sub },
});
