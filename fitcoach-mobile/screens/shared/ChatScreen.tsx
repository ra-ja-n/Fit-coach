// One thread per coach-client pair. REST history + realtime pushes; optimistic
// sends with explicit failed/retry states (never a false success).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { FlatList as FlatListType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request, handleWriteError } from '../../lib/api/api';
import { ApiError } from '../../lib/api/errors';
import { emitRealtime } from '../../lib/api/realtime';
import type { ChatContext, ChatMessage } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { TopBar } from '../../components/ui';
import { ChatDaySeparator, ChatInputBar, ChatLockedBar, MessageBubble } from '../../components/chat';
import { C, S, TYPE } from '../../theme/tokens';
import { fmtTime } from '../../lib/format';
import { buildChatRows, chatRowKey, type ChatRow, type PendingMsg } from '../../lib/chatRows';
import type { ClientStackParamList, CoachStackParamList } from '../../navigation/types';

type AnyParamList = ClientStackParamList & CoachStackParamList;

export default function ChatScreen({ route }: NativeStackScreenProps<AnyParamList, 'Chat'>) {
  const { coachId, clientId, name } = route.params;
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const listRef = useRef<FlatListType<ChatRow>>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', coachId, clientId],
    queryFn: () => request<ChatMessage[]>('chat.get', { coachId, clientId }),
  });

  const { data: ctx } = useQuery({
    queryKey: ['chat', 'context', coachId, clientId],
    queryFn: () => request<ChatContext>('chat.context', { coachId, clientId }),
  });

  const locked = ctx ? !ctx.active : false;

  // Mark as read whenever new messages arrive while viewing.
  useEffect(() => {
    if (messages.length) {
      request('chat.read', { coachId, clientId }).then(() => {
        qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
        qc.invalidateQueries({ queryKey: ['chat', 'clientSummary'] });
      }).catch(() => {});
    }
  }, [messages.length, coachId, clientId, qc]);

  const send = async (body: string, tempId?: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const tid = tempId ?? `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (!tempId) setPending((p) => [...p, { tempId: tid, body: trimmed, status: 'sending' }]);
    setDraft('');
    try {
      await request('chat.send', { coachId, clientId, body: trimmed });
      setPending((p) => p.filter((x) => x.tempId !== tid));
      qc.invalidateQueries({ queryKey: ['chat', coachId, clientId] });
      qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
      // Refresh now rather than waiting a round trip for the server's push.
      // The STOMP event still arrives and is idempotent.
      emitRealtime({ type: 'chat', coachId, clientId });
    } catch (e) {
      setPending((p) => p.map((x) => (x.tempId === tid ? { ...x, status: 'failed' } : x)));
      if (e instanceof ApiError && (e.code === 'SUBSCRIPTION_EXPIRED' || e.code === 'SUBSCRIBE_REQUIRED')) {
        handleWriteError(e);
      } else {
        showToast('Message not sent. Tap it to retry.', 'error');
      }
    }
  };

  const retry = (p: PendingMsg) => {
    setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, status: 'sending' } : x)));
    send(p.body, p.tempId);
  };

  const rows = useMemo(() => buildChatRows(messages, pending), [messages, pending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <View style={styles.headerPad}>
        <TopBar title={name} subtitle={locked ? 'Conversation archived' : ctx ? (me.role === 'coach' ? 'Your client' : 'Your coach') : undefined} />
      </View>

      <FlatList
        ref={listRef}
        data={rows}
        inverted
        keyExtractor={chatRowKey}
        renderItem={({ item }) => {
          if (item.kind === 'day') return <ChatDaySeparator label={item.label} />;
          const mine = item.kind === 'msg' ? item.msg.senderId === me.id : true;
          return (
            <MessageBubble
              body={item.kind === 'msg' ? item.msg.body : item.p.body}
              mine={mine}
              time={item.kind === 'msg' ? fmtTime(item.msg.createdAt) : ''}
              state={item.kind === 'pending' ? item.p.status : 'sent'}
              onRetry={item.kind === 'pending' ? () => retry(item.p) : undefined}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={TYPE.sub}>No messages yet. Say hello 👋</Text>
            </View>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {locked ? (
          <ChatLockedBar />
        ) : (
          <ChatInputBar value={draft} onChangeText={setDraft} onSend={() => send(draft)} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: S.xl, paddingTop: S.lg },
  listContent: { paddingHorizontal: S.xl, paddingVertical: S.md },
  empty: { alignItems: 'center', paddingTop: 80 },
});
