// Coach message center: one thread per client pair.
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { request } from '../../lib/api/api';
import type { ChatThreadRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { EmptyState, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { CoachClientListRow } from '../../components/coach';
import { C, S } from '../../theme/tokens';
import type { CoachStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CoachStackParamList>;

export default function MessagesScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;

  const q = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => request<ChatThreadRow[]>('chat.threads'),
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;
  if (q.isError) return <View style={{ flex: 1, backgroundColor: C.bg }}><ErrorState message="Could not load messages." onRetry={() => q.refetch()} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(t) => t.clientId}
        contentContainerStyle={{ padding: S.xl, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<TopBar title="Messages" subtitle="Private 1:1 threads with your clients" back={false} />}
        renderItem={({ item }) => (
          <CoachClientListRow
            thread={item}
            onPress={() => nav.navigate('Chat', { coachId: me.id, clientId: item.clientId, name: item.clientName })}
          />
        )}
        ListEmptyComponent={
          <EmptyState icon="chatbubble-outline" title="No threads yet" body="When clients subscribe, your private conversations appear here." />
        }
      />
    </View>
  );
}

// Invisible press layer (keeps row visuals simple).
import { Pressable } from 'react-native';
function FlatListTapper({ item, meId, nav }: { item: ChatThreadRow; meId: string; nav: Nav }) {
  return (
    <Pressable style={{ flex: 1 }} onPress={() => nav.navigate('Chat', { coachId: meId, clientId: item.clientId, name: item.clientName })} />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, padding: S.lg, marginBottom: S.md, overflow: 'hidden' },
  unread: { backgroundColor: C.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: C.white, fontSize: 11, fontWeight: '800' },
});
