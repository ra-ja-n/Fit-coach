// Coach business hub: profile editor, package management, plan library, revenue.
// All the editors live in components/coach — this screen only orchestrates data.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { request, handleWriteError } from '../../lib/api/api';
import { errorMessage } from '../../lib/api/errors';
import type { CoachProfile, Package, PlanTemplate, RevenueSummary, UpdateCoachProfilePayload } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Card, EmptyState, LoadingView, ModalSheet, SectionHeader, TopBar } from '../../components/ui';
import { Button } from '../../components/ui';
import {
  CoachProfileForm,
  PackageCard,
  PackageEditorSheet,
  PlanTemplateCard,
  RevenueSummaryTile,
} from '../../components/coach';
import { C, S, TYPE } from '../../theme/tokens';
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
  const packagesQ = useQuery({ queryKey: ['packages', 'mine'], queryFn: () => request<Package[]>('packages.mine') });
  const revenueQ = useQuery({ queryKey: ['coach', 'revenue'], queryFn: () => request<RevenueSummary>('coach.revenue') });
  const templatesQ = useQuery({ queryKey: ['templates'], queryFn: () => request<PlanTemplate[]>('templates.list') });

  const saveProfile = useMutation({
    mutationFn: (p: UpdateCoachProfilePayload) => request('coach.updateProfile', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coach'] }); showToast('Profile saved', 'success'); },
    onError: handleWriteError,
  });
  const deletePkg = useMutation({
    mutationFn: (id: string) => request('package.delete', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['packages'] }); showToast('Package deleted', 'success'); },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => request('templates.delete', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); showToast('Template deleted', 'success'); },
    onError: handleWriteError,
  });

  if (me.coachStatus === 'pending') {
    return (
      <View style={styles.root}>
        <View style={styles.padded}><TopBar title="Business" back={false} /></View>
        <EmptyState
          icon="hourglass-outline"
          title="Profile under review"
          body="Your coach profile is awaiting admin approval. You can prepare packages meanwhile — they go live with your profile."
        />
      </View>
    );
  }

  const profile = profileQ.data?.profile;
  const openTemplate = (kind: 'workout' | 'diet', templateId?: string) => {
    setNewTemplateOpen(false);
    nav.navigate('PlanBuilder', { kind, mode: 'template', templateId });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TopBar title="Business" subtitle="Profile, packages & revenue" back={false} />

        <RevenueSummaryTile revenue={revenueQ.data} />

        <SectionHeader title="Public profile" />
        {profileQ.isLoading ? <LoadingView /> : profile ? (
          <CoachProfileForm key={profile.userId} initial={profile} onSave={(p) => saveProfile.mutate(p)} saving={saveProfile.isPending} />
        ) : (
          <Card><Text style={TYPE.sub}>Profile unavailable. Pull to retry.</Text></Card>
        )}

        <SectionHeader title="Packages" action="+ New" onAction={() => setPkgEditor({ open: true, pkg: null })} />
        {(packagesQ.data ?? []).length === 0 && (
          <Card><Text style={TYPE.sub}>No packages yet. Create one so clients can subscribe.</Text></Card>
        )}
        {(packagesQ.data ?? []).map((p) => (
          <PackageCard key={p.id} pkg={p} onEdit={() => setPkgEditor({ open: true, pkg: p })} onDelete={() => deletePkg.mutate(p.id)} />
        ))}

        <SectionHeader title="Plan library" action="+ New" onAction={() => setNewTemplateOpen(true)} />
        <Text style={styles.libraryHint}>Pre-made plans you can assign to any client in one tap.</Text>
        {(templatesQ.data ?? []).length === 0 && !templatesQ.isLoading && (
          <Card><Text style={TYPE.sub}>No templates yet. Build a buffer of go-to plans so onboarding new clients takes seconds.</Text></Card>
        )}
        {(templatesQ.data ?? []).map((t) => (
          <PlanTemplateCard
            key={t.id}
            template={t}
            onEdit={() => openTemplate(t.kind, t.id)}
            onDelete={() => deleteTemplate.mutate(t.id)}
          />
        ))}

        <SectionHeader title="Session" />
        <Button label="Sign out" variant="outline" icon="log-out-outline" onPress={() => signOut()} />
      </ScrollView>

      <ModalSheet visible={newTemplateOpen} onClose={() => setNewTemplateOpen(false)} title="New plan template">
        <Button label="Workout template" icon="barbell-outline" style={{ marginBottom: S.md }} onPress={() => openTemplate('workout')} />
        <Button label="Nutrition template" icon="nutrition-outline" variant="soft" onPress={() => openTemplate('diet')} />
      </ModalSheet>

      <PackageEditorSheet
        visible={pkgEditor.open}
        pkg={pkgEditor.pkg}
        onClose={() => setPkgEditor({ open: false, pkg: null })}
        onSaved={() => {
          setPkgEditor({ open: false, pkg: null });
          qc.invalidateQueries({ queryKey: ['packages'] });
          qc.invalidateQueries({ queryKey: ['coach'] });
          showToast('Package saved', 'success');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  padded: { padding: S.xl },
  content: { padding: S.xl, paddingBottom: 48 },
  libraryHint: { ...TYPE.sub, marginBottom: S.md, marginTop: -S.xs },
});
