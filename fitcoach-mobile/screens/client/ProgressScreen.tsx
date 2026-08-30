// Client progress hub: daily tracker (weight/measurements/notes), weekly
// photo uploads, trend chart and full history. Every save pushes to the coach
// in real time.
import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import { photoToDataUrl, pickProgressPhoto } from '../../lib/photoUpload';
import { errorMessage } from '../../lib/api/errors';
import type { LogProgressPayload, ProgressEntry, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Button, EmptyState, ErrorState, LoadingView, LockedNotice, SectionHeader, TopBar } from '../../components/ui';
import { ProgressHistoryRow, ProgressLogSheet, ProgressPhotoStrip, ProgressSummaryRow } from '../../components/progress';
import { C, S } from '../../theme/tokens';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

export default function ProgressScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [logOpen, setLogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });
  const subs = subsQ.data ?? [];
  const active = subs.find((s) => s.status === 'active') ?? null;
  const pair = active ?? subs[0] ?? null;

  const entriesQ = useQuery({
    queryKey: ['progress', 'mine', pair?.coachId],
    queryFn: () => request<ProgressEntry[]>('progress.mine', { coachId: pair!.coachId }),
    enabled: !!pair,
  });

  const entries = entriesQ.data ?? [];
  const photoEntries = entries.filter((e) => e.photoUrls.length > 0);

  const logMutation = useMutation({
    mutationFn: (payload: LogProgressPayload) => request('progress.log', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      setLogOpen(false);
      showToast('Progress logged — your coach can see it now', 'success');
    },
    onError: handleWriteError,
  });

  const pickWeeklyPhoto = async () => {
    try {
      const photo = await pickProgressPhoto();
      if (!photo) return;
      setUploading(true);
      await request('progress.log', { photoUrl: photoToDataUrl(photo) });
      qc.invalidateQueries({ queryKey: ['progress'] });
      showToast('Weekly photo uploaded 📸', 'success');
    } catch (e) {
      // Permission denial arrives as a plain Error with a user-facing message.
      showToast(e instanceof Error && e.message === 'Photo library permission is needed' ? e.message : errorMessage(e), 'error');
    } finally {
      setUploading(false);
    }
  };

  const openPhoto = (uri: string, label: string) => nav.navigate('PhotoView', { uri, label });

  if (subsQ.isLoading) return <View style={styles.full}><LoadingView /></View>;

  if (!pair) {
    return (
      <View style={styles.full}>
        <View style={styles.headerPad}><TopBar title="Progress" back={false} /></View>
        <EmptyState
          icon="trending-up-outline"
          title="No coach yet"
          body="Subscribe to a coach to start tracking your progress with daily check-ins and weekly photos."
          actionLabel="Browse coaches"
          onAction={() => nav.navigate('Browse')}
        />
      </View>
    );
  }

  if (entriesQ.isError) {
    return <View style={styles.full}><ErrorState message={errorMessage(entriesQ.error)} onRetry={() => entriesQ.refetch()} /></View>;
  }

  return (
    <View style={styles.full}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <TopBar
              title="Progress"
              subtitle={`Coached by ${pair.coachName}`}
              back={false}
              right={active ? <Button label="Log today" icon="add" compact onPress={() => setLogOpen(true)} /> : undefined}
            />

                        {!active ? <LockedNotice text="Read-only — your plan ended. Renew to keep logging." /> : null}

            <View style={{ marginTop: S.sm }}>
              <ProgressSummaryRow entries={entries} />
            </View>

            <ProgressPhotoStrip
              entries={entries}
              actionLabel={active ? 'Upload' : undefined}
              onAction={active ? pickWeeklyPhoto : undefined}
              onUpload={active ? pickWeeklyPhoto : undefined}
              uploading={uploading}
              onOpenPhoto={openPhoto}
              emptyText="No photos uploaded."
            />

            <SectionHeader title="History" />
          </>
        }
        ListEmptyComponent={
          !entriesQ.isLoading ? (
            <EmptyState
              icon="create-outline"
              title="No check-ins yet"
              body={active ? 'Log today’s weight, measurements and a note — small data points become visible results.' : 'No history from this coaching period.'}
              actionLabel={active ? 'Log today' : undefined}
              onAction={active ? () => setLogOpen(true) : undefined}
            />
          ) : <LoadingView />
        }
        renderItem={({ item }) => <ProgressHistoryRow entry={item} onOpenPhoto={openPhoto} />}
      />

      <ProgressLogSheet
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={(payload) => logMutation.mutate(payload)}
        saving={logMutation.isPending}
        serverError={logMutation.isError ? errorMessage(logMutation.error) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg },
  headerPad: { padding: S.xl, paddingTop: S.xl },
  content: { padding: S.xl, paddingBottom: 48 },
});
