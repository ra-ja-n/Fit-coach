// Public discovery: clients browse approved coach profiles freely.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { CoachProfile } from '../../lib/api/types';
import { Avatar, Badge, Card, Chip, EmptyState, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

export default function BrowseScreen() {
  const nav = useNavigation<Nav>();
  const q = useQuery({
    queryKey: ['coaches'],
    queryFn: () => request<CoachProfile[]>('coaches.list'),
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.userId}
        contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<TopBar title="Find a coach" subtitle="Verified independent coaches" />}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: S.md }} onPress={() => nav.navigate('CoachDetail', { coachId: item.userId })}>
            <View style={{ flexDirection: 'row' }}>
              <Avatar name={item.name} size={54} />
              <View style={{ flex: 1, marginLeft: S.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[TYPE.h3, { flex: 1 }]}>{item.name}</Text>
                  {item.startingPriceCents != null && (
                    <Text style={{ color: C.primary, fontWeight: '800', fontSize: 14 }}>from {money(item.startingPriceCents)}</Text>
                  )}
                </View>
                <Text style={[TYPE.caption, { marginTop: 2 }]}>{item.experienceYears} YRS EXPERIENCE{item.activeClients ? ` · ${item.activeClients} ACTIVE CLIENTS` : ''}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: S.sm }}>
                  {item.specialties.slice(0, 3).map((s) => <Chip key={s} label={s} />)}
                </View>
              </View>
            </View>
            <Text style={[TYPE.sub, { marginTop: S.md }]} numberOfLines={2}>{item.bio}</Text>
          </Card>
        )}
        ListEmptyComponent={
          q.isLoading ? <LoadingView /> :
          q.isError ? <ErrorState message="Could not load coaches." onRetry={() => q.refetch()} /> :
          <EmptyState icon="people-outline" title="No coaches yet" body="Check back soon — new coaches are approved every week." />
        }
      />
    </View>
  );
}
