// Coach profile + packages + subscribe/renew entry point.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { CoachProfile, Package, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, Button, Card, Chip, ErrorState, LoadingView, SectionHeader, TopBar } from '../../components/ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

export default function CoachDetailScreen({ route, navigation }: NativeStackScreenProps<ClientStackParamList, 'CoachDetail'>) {
  const { coachId } = route.params;
  const me = useAuthStore((s) => s.user)!;

  const q = useQuery({
    queryKey: ['coach', coachId],
    queryFn: () => request<{ profile: CoachProfile; packages: Package[] }>('coach.getPublic', { coachId }),
  });

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load this coach." onRetry={() => q.refetch()} /></View>;

  const { profile, packages } = q.data;
  const mySubHere = (subsQ.data ?? []).find((s) => s.coachId === coachId);
  const activeHere = mySubHere?.status === 'active';
  const activeElsewhere = (subsQ.data ?? []).some((s) => s.status === 'active' && s.coachId !== coachId);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TopBar title="Coach profile" />

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={profile.name} size={62} />
            <View style={{ flex: 1, marginLeft: S.lg }}>
              <Text style={TYPE.h2}>{profile.name}</Text>
              <Text style={[TYPE.caption, { marginTop: 3 }]}>{profile.experienceYears} YEARS EXPERIENCE</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: S.lg }}>
            {profile.specialties.map((s) => <Chip key={s} label={s} />)}
          </View>
          <Text style={[TYPE.body, { marginTop: S.lg, lineHeight: 22 }]}>{profile.bio}</Text>
        </Card>

        {activeHere && mySubHere && (
          <View style={styles.activeBox}>
            <Ionicons name="checkmark-circle" size={18} color={C.primary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.primaryDark, flex: 1 }}>
              Active plan: {mySubHere.packageTitle}. You're all set.
            </Text>
          </View>
        )}

        <SectionHeader title={mySubHere && !activeHere ? 'Renew your plan' : 'Coaching packages'} />
        {packages.length === 0 && <Text style={TYPE.sub}>This coach hasn't published packages yet.</Text>}
        {packages.map((p) => (
          <Card key={p.id} style={{ marginBottom: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={TYPE.h3}>{p.title}</Text>
                <Text style={TYPE.sub}>{p.durationDays} days of coaching</Text>
              </View>
              <Text style={styles.price}>{money(p.priceCents)}</Text>
            </View>
            <View style={{ marginTop: S.md }}>
              {p.features.map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}>
                  <Ionicons name="checkmark" size={15} color={C.primary} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 13.5, color: C.sub, fontWeight: '500' }}>{f}</Text>
                </View>
              ))}
            </View>
            <Button
              label={mySubHere && !activeHere ? 'Renew this plan' : 'Subscribe'}
              variant={activeElsewhere ? 'soft' : 'primary'}
              style={{ marginTop: S.lg }}
              onPress={() => navigation.navigate('Checkout', { packageId: p.id, coachId })}
            />
            {activeElsewhere && (
              <Text style={[TYPE.caption, { marginTop: S.sm, textAlign: 'center' }]}>You'll need to cancel your current plan first</Text>
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  activeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primarySoft, borderRadius: R.md, padding: S.lg, marginTop: S.lg },
  price: { fontSize: 20, fontWeight: '800', color: C.ink },
});
