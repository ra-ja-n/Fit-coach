// Chat tab for clients: resolves their single coach-client pair.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request } from '../../lib/api/api';
import type { ChatMessage, SubscriptionRow } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { Avatar, EmptyState, LoadingView, TopBar } from '../../components/ui';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';
import type { ClientStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<ClientStackParamList>;

export default function ChatTabScreen() {
  const nav = useNavigation<Nav>();
  const me = useAuthStore((s) => s.user)!;

  const subsQ = useQuery({
    queryKey: ['subs', 'mine'],
    queryFn: () => request<SubscriptionRow[]>('subs.mine'),
  });
  const pair = (subsQ.data ?? []).find((s) => s.status === 'active') ?? (subsQ.data ?? [])[0] ?? null;

  const msgsQ = useQuery({
    queryKey: ['chat', pair?.coachId, me.id],
    queryFn: () => request<ChatMessage[]>('chat.get', { coachId: pair!.coachId, clientId: me.id }),
    enabled: !!pair,
  });

  if (subsQ.isLoading) return <View style={{ flex: 1, backgroundColor: C.bg }}><LoadingView /></View>;

  if (!pair) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: S.xl }}><TopBar title="Messages" back={false} /></View>
        <EmptyState
          icon="chatbubble-outline"
          title="No conversation yet"
          body="Once you subscribe to a coach, your private 1:1 thread lives here."
          actionLabel="Browse coaches"
          onAction={() => nav.navigate('Browse')}
        />
      </View>
    );
  }

  const msgs = msgsQ.data ?? [];
  const last = msgs[msgs.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: S.xl, paddingBottom: 0 }}><TopBar title="Messages" subtitle="Private 1:1 with your coach" back={false} /></View>
      <Pressable onPress={() => nav.navigate('Chat', { coachId: pair.coachId, clientId: me.id, name: pair.coachName })} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        <View style={styles.row}>
          <Avatar name={pair.coachName} size={50} />
          <View style={{ flex: 1, marginLeft: S.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{pair.coachName}</Text>
              {last ? <Text style={TYPE.caption}>{timeAgo(last.createdAt)}</Text> : null}
            </View>
            <Text style={[TYPE.sub, { marginTop: 2 }]} numberOfLines={2}>
              {last ? `${last.senderId === me.id ? 'You: ' : ''}${last.body}` : 'Start the conversation'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ marginLeft: S.sm }} />
        </View>
      </Pressable>
      {pair.status !== 'active' && (
        <View style={{ marginHorizontal: S.xl, marginTop: S.sm, backgroundColor: C.accentSoft, borderRadius: 12, padding: S.md }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: C.accentInk }}>
            This conversation is archived — messaging ended with your subscription.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: S.xl, borderRadius: 18, borderWidth: 1, borderColor: C.lineSoft, padding: S.lg },
});
