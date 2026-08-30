// Client progress hub: daily tracker (weight/measurements/notes), weekly
// photo uploads, trend chart and full history. Every save pushes to the coach
// in real time.
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import { errorMessage } from '../../lib/api/errors';
import type { ProgressEntry, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { ProgressSchema, type ProgressForm } from '../../lib/validation';
import { Button, Card, EmptyState, ErrorState, Field, LoadingView, ModalSheet, SectionHeader, StatTile, TopBar } from '../../components/ui';
import { WeightChart } from '../../components/WeightChart';
import { C, R, S, TYPE } from '../../theme/tokens';
import { fmtDay, todayISO } from '../../lib/format';
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
  const chrono = useMemo(() => [...entries].reverse().filter((e) => e.weightKg != null), [entries]);
  const current = entries.find((e) => e.weightKg != null)?.weightKg ?? null;
  const firstWeight = chrono.length ? chrono[0].weightKg : null;
  const delta = current != null && firstWeight != null ? +(current - firstWeight).toFixed(1) : null;
  const photoEntries = entries.filter((e) => e.photoUrls.length > 0);

  const logMutation = useMutation({
    mutationFn: (payload: any) => request('progress.log', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress'] });
      setLogOpen(false);
      showToast('Progress logged — your coach can see it now', 'success');
    },
    onError: (e) => handleWriteError(e),
  });

  const pickWeeklyPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Photo library permission is needed', 'error');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.35,
        base64: true,
        allowsEditing: true,
        aspect: [4, 5],
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setUploading(true);
      await request('progress.log', { photoUrl: uri });
      qc.invalidateQueries({ queryKey: ['progress'] });
      showToast('Weekly photo uploaded 📸', 'success');
    } catch (e) {
      handleWriteError(e);
    } finally {
      setUploading(false);
    }
  };

  if (subsQ.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;

  if (!pair) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.xl, paddingTop: S.xl }}>
          <TopBar title="Progress" back={false} />
        </View>
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
    return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message={errorMessage(entriesQ.error)} onRetry={() => entriesQ.refetch()} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }}
        ListHeaderComponent={
          <>
            <TopBar
              title="Progress"
              subtitle={`Coached by ${pair.coachName}`}
              back={false}
              right={active ? <Button label="Log today" icon="add" compact onPress={() => setLogOpen(true)} /> : undefined}
            />

            {!active && (
              <View style={styles.readOnlyBar}>
                <Ionicons name="lock-closed-outline" size={14} color={'#9A6712'} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#9A6712', flex: 1 }}>
                  Read-only — your plan ended. Renew to keep logging.
                </Text>
              </View>
            )}

            {/* Stats */}
            <View style={{ flexDirection: 'row', marginTop: S.sm }}>
              <StatTile label="Start" value={firstWeight != null ? `${firstWeight} kg` : '—'} />
              <View style={{ width: S.md }} />
              <StatTile label="Current" value={current != null ? `${current} kg` : '—'} />
              <View style={{ width: S.md }} />
              <StatTile
                label="Change"
                value={delta != null ? `${delta > 0 ? '+' : ''}${delta} kg` : '—'}
                tone={delta != null ? (delta <= 0 ? 'green' : 'red') : undefined}
              />
            </View>

            {/* Chart */}
            <Card style={{ marginTop: S.lg }}>
              <Text style={[TYPE.caption, { marginBottom: S.sm }]}>WEIGHT TREND</Text>
              <WeightChart data={chrono.map((e) => ({ date: e.date, value: e.weightKg! }))} />
            </Card>

            {/* Weekly photos */}
            <SectionHeader
              title="Weekly photos"
              action={active ? 'Upload' : undefined}
              onAction={active ? pickWeeklyPhoto : undefined}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -S.xl }} contentContainerStyle={{ paddingHorizontal: S.xl }}>
              {active && (
                <Pressable onPress={pickWeeklyPhoto} disabled={uploading} style={styles.photoAdd}>
                  {uploading ? (
                    <Ionicons name="hourglass-outline" size={22} color={C.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color={C.primary} />
                  )}
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.primaryDark, marginTop: 6 }}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
                </Pressable>
              )}
              {photoEntries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => nav.navigate('PhotoView', { uri: e.photoUrls[e.photoUrls.length - 1], label: fmtDay(e.date) })}
                  style={{ marginRight: S.md }}
                >
                  <Image source={{ uri: e.photoUrls[e.photoUrls.length - 1] }} style={styles.photoThumb} />
                  <Text style={[TYPE.caption, { marginTop: 6, textAlign: 'center' }]}>{fmtDay(e.date)}</Text>
                </Pressable>
              ))}
              {!photoEntries.length && !active ? <Text style={[TYPE.sub, { paddingVertical: S.lg }]}>No photos uploaded.</Text> : null}
            </ScrollView>

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
        renderItem={({ item }) => (
          <Card style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.h3}>{fmtDay(item.date)}</Text>
                <Text style={TYPE.sub}>
                  {[item.weightKg ? `${item.weightKg} kg` : null, item.measurements.waist ? `waist ${item.measurements.waist}cm` : null]
                    .filter(Boolean).join(' · ') || 'Check-in'}
                </Text>
              </View>
              {item.photoUrls.length > 0 && (
                <Pressable onPress={() => nav.navigate('PhotoView', { uri: item.photoUrls[item.photoUrls.length - 1], label: fmtDay(item.date) })}>
                  <Image source={{ uri: item.photoUrls[item.photoUrls.length - 1] }} style={styles.historyThumb} />
                </Pressable>
              )}
            </View>
            {item.notes ? <Text style={[TYPE.sub, { marginTop: S.sm, fontStyle: 'italic' }]}>“{item.notes}”</Text> : null}
          </Card>
        )}
      />

      <LogSheet
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        onSubmit={(v) => logMutation.mutate(v)}
        saving={logMutation.isPending}
        serverError={logMutation.isError ? errorMessage(logMutation.error) : null}
      />
    </View>
  );
}

function LogSheet({ visible, onClose, onSubmit, saving, serverError }: {
  visible: boolean; onClose: () => void;
  onSubmit: (payload: { weightKg: number | null; measurements: Record<string, number>; notes: string }) => void;
  saving: boolean; serverError: string | null;
}) {
  const { control, handleSubmit, reset } = useForm<ProgressForm>({
    resolver: zodResolver(ProgressSchema),
    defaultValues: { weight: '', waist: '', chest: '', hips: '', notes: '' },
  });

  const submit = (data: ProgressForm) => {
    const measurements: Record<string, number> = {};
    if (data.waist.trim()) measurements.waist = Number(data.waist);
    if (data.chest.trim()) measurements.chest = Number(data.chest);
    if (data.hips.trim()) measurements.hips = Number(data.hips);
    onSubmit({
      weightKg: data.weight.trim() ? Number(data.weight) : null,
      measurements,
      notes: data.notes.trim(),
    });
  };

  return (
    <ModalSheet visible={visible} onClose={() => { reset(); onClose(); }} title={`Check-in · ${todayISO()}`}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {serverError ? <Text style={{ color: C.danger, fontSize: 13, fontWeight: '600', marginBottom: S.md }}>{serverError}</Text> : null}
        <Controller control={control} name="weight" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Weight (kg)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="e.g. 78.4" keyboardType="decimal-pad" prefixIcon="scale-outline" />
        )} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: S.sm }}>
            <Controller control={control} name="waist" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Waist (cm)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="—" keyboardType="decimal-pad" />
            )} />
          </View>
          <View style={{ flex: 1, marginRight: S.sm }}>
            <Controller control={control} name="chest" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Chest (cm)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="—" keyboardType="decimal-pad" />
            )} />
          </View>
          <View style={{ flex: 1 }}>
            <Controller control={control} name="hips" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Hips (cm)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="—" keyboardType="decimal-pad" />
            )} />
          </View>
        </View>
        <Controller control={control} name="notes" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Notes" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Sleep, energy, soreness…" multiline numberOfLines={3} />
        )} />
        <Button label={saving ? 'Saving…' : 'Save check-in'} loading={saving} onPress={handleSubmit(submit)} />
        <Text style={[TYPE.caption, { textAlign: 'center', marginTop: S.md }]}>Visible to your coach instantly</Text>
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  readOnlyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: 10, marginTop: S.sm },
  photoAdd: { width: 108, height: 135, borderRadius: R.md, borderWidth: 1.5, borderColor: C.primary, borderStyle: 'dashed', backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  photoThumb: { width: 108, height: 135, borderRadius: R.md, backgroundColor: C.surfaceAlt },
  historyThumb: { width: 52, height: 62, borderRadius: 10, backgroundColor: C.surfaceAlt },
});
