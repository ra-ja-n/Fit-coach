// Coach business hub: profile editor, package management, revenue.
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import { errorMessage } from '../../lib/api/errors';
import type { CoachProfile, Package, PlanTemplate, RevenueSummary } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { PackageSchema, ProfileSchema, type PackageForm, type ProfileForm } from '../../lib/validation';
import { Avatar, Badge, Button, Card, EmptyState, Field, LoadingView, ModalSheet, SectionHeader, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { fmtDate, money, timeAgo } from '../../lib/format';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList>;

export default function CoachProfileScreen() {
  const me = useAuthStore((s) => s.user)!;
  const signOut = useAuthStore((s) => s.signOut);
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [pkgEditor, setPkgEditor] = useState<{ open: boolean; pkg: Package | null }>({ open: false, pkg: null });
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);

  const profileQ = useQuery({
    queryKey: ['coach', me.id],
    queryFn: () => request<{ profile: CoachProfile; packages: Package[] }>('coach.getPublic', { coachId: me.id }),
    retry: false,
  });
  const packagesQ = useQuery({
    queryKey: ['packages', 'mine'],
    queryFn: () => request<Package[]>('packages.mine'),
  });
  const revenueQ = useQuery({
    queryKey: ['coach', 'revenue'],
    queryFn: () => request<RevenueSummary>('coach.revenue'),
  });
  const templatesQ = useQuery({
    queryKey: ['templates'],
    queryFn: () => request<PlanTemplate[]>('templates.list'),
  });

  const saveProfile = useMutation({
    mutationFn: (p: any) => request('coach.updateProfile', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coach'] }); showToast('Profile saved', 'success'); },
    onError: (e) => handleWriteError(e),
  });
  const deletePkg = useMutation({
    mutationFn: (id: string) => request('package.delete', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); showToast('Package deleted', 'success'); },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => request('templates.delete', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); showToast('Template deleted', 'success'); },
    onError: (e) => handleWriteError(e),
  });

  if (me.coachStatus === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.xl }}><TopBar title="Business" back={false} /></View>
        <EmptyState icon="hourglass-outline" title="Profile under review" body="Your coach profile is awaiting admin approval. You can prepare packages meanwhile — they go live with your profile." />
      </View>
    );
  }

  const profile = profileQ.data?.profile;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar title="Business" subtitle="Profile, packages & revenue" back={false} />

        {/* Revenue */}
        <Card>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1 }}>
              <Text style={TYPE.caption}>THIS MONTH</Text>
              <Text style={styles.money}>{revenueQ.data ? money(revenueQ.data.thisMonthCents) : '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={TYPE.caption}>LIFETIME</Text>
              <Text style={styles.money}>{revenueQ.data ? money(revenueQ.data.totalCents) : '—'}</Text>
            </View>
            <View style={{ flex: 0.8 }}>
              <Text style={TYPE.caption}>CLIENTS</Text>
              <Text style={styles.money}>{revenueQ.data?.activeClients ?? '—'}</Text>
            </View>
          </View>
          {(revenueQ.data?.recent ?? []).length > 0 && (
            <View style={{ marginTop: S.lg, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.lineSoft }}>
              {revenueQ.data!.recent.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.payRow}>
                  <Text style={[TYPE.sub, { flex: 1 }]} numberOfLines={1}>{r.clientName} · {r.packageTitle}</Text>
                  <Text style={{ fontWeight: '700', color: C.primary, fontSize: 13.5 }}>{money(r.amountCents)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Profile */}
        <SectionHeader title="Public profile" />
        {profileQ.isLoading ? <LoadingView /> : profile ? (
          <ProfileForm
            key={profile.userId + profile.bio.slice(0, 8)}
            initial={profile}
            onSave={(p) => saveProfile.mutate(p)}
            saving={saveProfile.isPending}
          />
        ) : (
          <Card><Text style={TYPE.sub}>Profile unavailable. Pull to retry.</Text></Card>
        )}

        {/* Packages */}
        <SectionHeader title="Packages" action="+ New" onAction={() => setPkgEditor({ open: true, pkg: null })} />
        {(packagesQ.data ?? []).length === 0 && (
          <Card><Text style={TYPE.sub}>No packages yet. Create one so clients can subscribe.</Text></Card>
        )}
        {(packagesQ.data ?? []).map((p) => (
          <Card key={p.id} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.h3}>{p.title}</Text>
                <Text style={TYPE.sub}>{money(p.priceCents)} · {p.durationDays} days</Text>
              </View>
              <Button label="Edit" compact variant="outline" onPress={() => setPkgEditor({ open: true, pkg: p })} style={{ marginRight: S.sm }} />
              <Button
                label="Delete" compact variant="dangerSoft"
                onPress={() => Alert.alert('Delete package?', 'Only possible while nobody has purchased it.', [
                  { text: 'Keep', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deletePkg.mutate(p.id) },
                ])}
              />
            </View>
          </Card>
        ))}

        {/* Plan library */}
        <SectionHeader title="Plan library" action="+ New" onAction={() => setNewTemplateOpen(true)} />
        <Text style={[TYPE.sub, { marginBottom: S.md, marginTop: -S.xs }]}>
          Pre-made plans you can assign to any client in one tap.
        </Text>
        {(templatesQ.data ?? []).length === 0 && !templatesQ.isLoading && (
          <Card><Text style={TYPE.sub}>No templates yet. Build a buffer of go-to plans so onboarding new clients takes seconds.</Text></Card>
        )}
        {(templatesQ.data ?? []).map((t) => (
          <Card key={t.id} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.tplIcon}>
                <Ionicons name={t.kind === 'workout' ? 'barbell-outline' : 'nutrition-outline'} size={17} color={C.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={TYPE.h3}>{t.title}</Text>
                <Text style={TYPE.sub} numberOfLines={1}>{t.kind === 'workout' ? 'Workout' : 'Nutrition'} · updated {timeAgo(t.updatedAt)}</Text>
              </View>
              <Button label="Edit" compact variant="outline" style={{ marginRight: S.sm }}
                onPress={() => nav.navigate('PlanBuilder', { kind: t.kind, mode: 'template', templateId: t.id })} />
              <Button label="Delete" compact variant="dangerSoft" onPress={() => deleteTemplate.mutate(t.id)} />
            </View>
            {t.note ? <Text style={[TYPE.sub, { marginTop: S.md, fontStyle: 'italic' }]}>“{t.note}”</Text> : null}
          </Card>
        ))}

        <SectionHeader title="Session" />
        <Button label="Sign out" variant="outline" icon="log-out-outline" onPress={() => signOut()} />
      </ScrollView>

      {/* New template kind picker */}
      <ModalSheet visible={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} title="New plan template">
        <Button label="Workout template" icon="barbell-outline" style={{ marginBottom: S.md }}
          onPress={() => { setNewTemplateOpen(false); nav.navigate('PlanBuilder', { kind: 'workout', mode: 'template' }); }} />
        <Button label="Nutrition template" icon="nutrition-outline" variant="soft"
          onPress={() => { setNewTemplateOpen(false); nav.navigate('PlanBuilder', { kind: 'diet', mode: 'template' }); }} />
      </ModalSheet>

      <PackageEditorSheet
        visible={pkgEditor.open}
        pkg={pkgEditor.pkg}
        onClose={() => setPkgEditor({ open: false, pkg: null })}
        onSaved={() => { setPkgEditor({ open: false, pkg: null }); qc.invalidateQueries({ queryKey: ['packages'] }); qc.invalidateQueries({ queryKey: ['coach'] }); showToast('Package saved', 'success'); }}
      />
    </View>
  );
}

function ProfileForm({ initial, onSave, saving }: { initial: CoachProfile; onSave: (p: any) => void; saving: boolean }) {
  const { control, handleSubmit } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: { bio: initial.bio, specialties: initial.specialties.join(', '), experienceYears: String(initial.experienceYears) },
  });
  const submit = (d: ProfileForm) => onSave({
    bio: d.bio.trim(),
    specialties: d.specialties.split(',').map((s) => s.trim()).filter(Boolean),
    experienceYears: Number(d.experienceYears),
  });
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.lg }}>
        <Avatar name={initial.name} size={44} />
        <View style={{ marginLeft: S.md, flex: 1 }}>
          <Text style={TYPE.h3}>{initial.name}</Text>
          <Badge label={initial.status.toUpperCase()} tone={initial.status === 'approved' ? 'green' : 'amber'} />
        </View>
      </View>
      <Controller control={control} name="bio" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Bio" value={value} onChangeText={onChangeText} error={fieldState.error?.message} multiline numberOfLines={4} />
      )} />
      <Controller control={control} name="specialties" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Specialties (comma separated)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Fat loss, Strength" />
      )} />
      <Controller control={control} name="experienceYears" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
        <Field label="Experience (years)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
      )} />
      <Button label={saving ? 'Saving…' : 'Save profile'} loading={saving} onPress={handleSubmit(submit)} />
    </Card>
  );
}

function PackageEditorSheet({ visible, pkg, onClose, onSaved }: { visible: boolean; pkg: Package | null; onClose: () => void; onSaved: () => void }) {
  const showToast = useUIStore((s) => s.showToast);
  const { control, handleSubmit, reset } = useForm<PackageForm>({
    resolver: zodResolver(PackageSchema),
    defaultValues: pkg
      ? { title: pkg.title, price: (pkg.priceCents / 100).toString(), durationDays: String(pkg.durationDays), featuresText: pkg.features.join('\n') }
      : { title: '', price: '', durationDays: '30', featuresText: '' },
  });

  const save = useMutation({
    mutationFn: (p: any) => request('package.save', p),
    onSuccess: () => { reset(); onSaved(); },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  const submit = (d: PackageForm) => save.mutate({
    id: pkg?.id,
    title: d.title.trim(),
    priceCents: Math.round(Number(d.price) * 100),
    durationDays: Number(d.durationDays),
    features: d.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
  });

  return (
    <ModalSheet visible={visible} onClose={() => { reset(); onClose(); }} title={pkg ? 'Edit package' : 'New package'}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Controller control={control} name="title" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Title" value={value} onChangeText={onChangeText} error={fieldState.error?.message} placeholder="Monthly Coaching" />
        )} />
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: S.sm }}>
            <Controller control={control} name="price" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Price (USD)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="decimal-pad" placeholder="59" />
            )} />
          </View>
          <View style={{ flex: 1 }}>
            <Controller control={control} name="durationDays" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
              <Field label="Duration (days)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} keyboardType="number-pad" />
            )} />
          </View>
        </View>
        <Controller control={control} name="featuresText" render={({ field: { value, onChange: onChangeText }, fieldState }) => (
          <Field label="Features (one per line)" value={value} onChangeText={onChangeText} error={fieldState.error?.message} multiline numberOfLines={4} placeholder={'Personalised workout plan\nChat support'} />
        )} />
        <Button label={save.isPending ? 'Saving…' : 'Save package'} loading={save.isPending} onPress={handleSubmit(submit)} />
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  money: { fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 3 },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  tplIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
