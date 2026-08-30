// Coach view of one client: progress overview, plans management (create, edit,
// or assign a pre-made library template), chat. Read-only automatically when
// the subscription lapses — every write affordance is gated on `isActive`.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import type { ClientDetailBundle, PlanTemplate, PlansBundle, ProgressEntry } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Button, ErrorState, LoadingView, ModalSheet, SectionHeader, TopBar } from '../../components/ui';
import { LatestCheckInCard, ProgressPhotoStrip, ProgressSummaryRow } from '../../components/progress';
import { PlanTemplatePicker } from '../../components/plan';
import { AdherenceChips, ClientHeaderCard, PlanAdminRow } from '../../components/coach';
import { C, S, TYPE } from '../../theme/tokens';
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
    onError: handleWriteError,
  });

  if (detailQ.isLoading) return <View style={styles.root}><LoadingView /></View>;
  if (detailQ.isError || !detailQ.data) {
    return <View style={styles.root}><ErrorState message="This client is not in your roster." onRetry={() => detailQ.refetch()} /></View>;
  }

  const d = detailQ.data;
  const isActive = d.status === 'active';
  const entries = progressQ.data ?? [];
  const photos = entries.filter((e) => e.photoUrls.length > 0);
  const candidates = (templatesQ.data ?? []).filter((t) => t.kind === libraryKind);
  const openBuilder = (kind: 'workout' | 'diet') =>
    navigation.navigate('PlanBuilder', { clientId, kind, clientName: d.clientName });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <ClientHeaderCard
          clientName={d.clientName}
          packageTitle={d.packageTitle}
          startDate={d.startDate}
          endDate={d.endDate}
          status={d.status}
        />

        <SectionHeader title="Progress" />
        <ProgressSummaryRow entries={entries} />
        <LatestCheckInCard entry={entries[0]} />

        {photos.length > 0 && (
          <ProgressPhotoStrip
            entries={entries}
            onOpenPhoto={(uri, label) =>
              navigation.navigate('PhotoView', { uri, label: `${d.clientName} · ${label}` })
            }
          />
        )}

        <SectionHeader title="Plans" />
        <AdherenceChips
          workoutChecked={d.workoutChecked}
          workoutTotal={d.workoutTotal}
          dietChecked={d.dietChecked}
          dietTotal={d.dietTotal}
        />
        <PlanAdminRow
          icon="barbell-outline"
          title={plansQ.data?.workout?.title}
          emptyLabel="No workout plan yet"
          updated={plansQ.data?.workout?.updatedAt}
          canEdit={isActive}
          onEdit={() => openBuilder('workout')}
          onLibrary={() => setLibraryKind('workout')}
        />
        <PlanAdminRow
          icon="nutrition-outline"
          title={plansQ.data?.diet?.title}
          emptyLabel="No nutrition plan yet"
          updated={plansQ.data?.diet?.updatedAt}
          canEdit={isActive}
          onEdit={() => openBuilder('diet')}
          onLibrary={() => setLibraryKind('diet')}
        />
      </ScrollView>

      <ModalSheet
        visible={libraryKind !== null}
        onClose={() => setLibraryKind(null)}
        title={libraryKind === 'workout' ? 'Assign workout template' : 'Assign nutrition template'}
      >
        {candidates.length === 0 && (
          <Text style={styles.noTemplates}>No {libraryKind} templates yet. Create them in Business → Plan library.</Text>
        )}
        {candidates.map((t) => (
          <PlanTemplatePicker key={t.id} template={t} busy={assignMutation.isPending} onAssign={() => assignMutation.mutate(t.id)} />
        ))}
      </ModalSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingBottom: 48 },
  noTemplates: { ...TYPE.sub, marginBottom: S.md },
});
