// Coach message center: one thread per client pair.
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { ChatThreadRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, EmptyState, ErrorState, LoadingView, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';
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
          <View style={[styles.row, !item.active && { opacity: 0.72 }]}>
            <Avatar name={item.clientName} size={48} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{item.clientName}</Text>
                {!item.active && <Ionicons name="lock-closed" size={13} color={C.faint} style={{ marginRight: 6 }} />}
                {item.lastAt ? <Text style={TYPE.caption}>{timeAgo(item.lastAt)}</Text> : null}
              </View>
              <Text style={[TYPE.sub, { marginTop: 2 }]} numberOfLines={1}>{item.lastMessage}</Text>
            </View>
            {item.unread > 0 ? (
              <View style={styles.unread}><Text style={styles.unreadText}>{item.unread}</Text></View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ marginLeft: S.sm }} />
            {/* Full-row tap target */}
            <View style={StyleSheet.absoluteFill}>
              <FlatListTapper item={item} meId={me.id} nav={nav} />
            </View>
          </View>
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
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: '#EDF0EA', padding: S.lg, marginBottom: S.md, overflow: 'hidden' },
  unread: { backgroundColor: C.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
