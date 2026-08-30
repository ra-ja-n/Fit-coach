// Client profile: account, subscription history, cancel, sign out.
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import type { SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { Avatar, Badge, Button, Card, SectionHeader, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { fmtDate, money } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

export default function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;
  const signOut = useAuthStore((s) => s.signOut);
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });

  const cancelMutation = useMutation({
    mutationFn: (subId: string) => request('subs.cancel', { subId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subs'] });
      showToast('Subscription cancelled. History stays readable.', 'success');
    },
    onError: (e) => handleWriteError(e),
  });

  const confirmCancel = (sub: SubscriptionRow) => {
    Alert.alert(
      'Cancel subscription?',
      `You'll lose messaging and updates from ${sub.coachName} immediately. Your plans and history remain readable, and renewing later restores everything.`,
      [
        { text: 'Keep my plan', style: 'cancel' },
        { text: 'Cancel plan', style: 'destructive', onPress: () => { setCancellingId(sub.id); cancelMutation.mutate(sub.id, { onSettled: () => setCancellingId(null) }); } },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar title="Profile" back={false} />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={me.name} size={56} />
            <View style={{ flex: 1, marginLeft: S.lg }}>
              <Text style={TYPE.h2}>{me.name}</Text>
              <Text style={TYPE.sub}>{me.email}</Text>
              <View style={{ marginTop: 6 }}><Badge label="CLIENT" tone="blue" /></View>
            </View>
          </View>
        </Card>

        <Button label="Find a coach" icon="search-outline" variant="soft" style={{ marginTop: S.lg }} onPress={() => nav.navigate('Browse')} />

        <SectionHeader title="Coaching history" />
        {(subsQ.data ?? []).length === 0 && (
          <Card><Text style={TYPE.sub}>No subscriptions yet. Browse coaches to get started.</Text></Card>
        )}
        {(subsQ.data ?? []).map((sub) => (
          <Card key={sub.id} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={sub.coachName} size={40} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <Text style={TYPE.h3}>{sub.coachName}</Text>
                <Text style={TYPE.sub}>{sub.packageTitle}</Text>
              </View>
              <Badge label={sub.status.toUpperCase()} tone={sub.status === 'active' ? 'green' : sub.status === 'cancelled' ? 'red' : 'amber'} />
            </View>
            <View style={styles.subMeta}>
              <Text style={TYPE.caption}>{fmtDate(sub.startDate)} → {fmtDate(sub.endDate)}</Text>
              <Text style={TYPE.caption}>{money(sub.priceCents)}</Text>
            </View>
            {sub.status === 'active' && (
              <Button
                label={cancellingId === sub.id ? 'Cancelling…' : 'Cancel subscription'}
                variant="dangerSoft"
                compact
                loading={cancellingId === sub.id}
                style={{ marginTop: S.md, alignSelf: 'flex-start' }}
                onPress={() => confirmCancel(sub)}
              />
            )}
          </Card>
        ))}

        <SectionHeader title="Session" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: S.md }}>
            <Ionicons name="shield-checkmark-outline" size={18} color={C.primary} style={{ marginRight: 10 }} />
            <Text style={[TYPE.sub, { flex: 1 }]}>Tokens are stored in the device secure enclave and refresh silently.</Text>
          </View>
          <Button label="Sign out" variant="outline" icon="log-out-outline" onPress={() => signOut()} />
        </Card>

        <Text style={[TYPE.caption, { textAlign: 'center', marginTop: S.xxl }]}>FITCOACH v1.0 · MVP SANDBOX</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.lineSoft },
});
