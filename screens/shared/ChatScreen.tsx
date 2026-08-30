// One thread per coach-client pair. REST history + realtime pushes; optimistic
// sends with explicit failed/retry states (never a false success).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { request, handleWriteError } from '../../lib/api/api';
import { ApiError } from '../../lib/api/errors';
import type { ChatContext, ChatMessage } from '../../lib/api/types';
import { useAuthStore } from '../../state/authStore';
import { useUIStore } from '../../state/uiStore';
import { TopBar } from '../../components/ui';
import { C, R, S, SHADOW, TYPE } from '../../theme/tokens';
import { fmtTime, dayLabel } from '../../lib/format';
import type { ClientStackParamList, CoachStackParamList } from '../../navigation/types';

type AnyParamList = ClientStackParamList & CoachStackParamList;

interface PendingMsg { tempId: string; body: string; status: 'sending' | 'failed' }

export default function ChatScreen({ route }: NativeStackScreenProps<AnyParamList, 'Chat'>) {
  const { coachId, clientId, name } = route.params;
  const me = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();
  const showToast = useUIStore((s) => s.showToast);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const listRef = useRef<FlatList<any>>(null);

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

  // Data is ordered NEWEST-FIRST because the FlatList is `inverted`: index 0
  // renders at the BOTTOM. That puts the newest message at the bottom (like
  // WhatsApp) and day separators visually above their day's messages.
  const rows = useMemo(() => {
    const items: Array<{ kind: 'msg'; msg: ChatMessage } | { kind: 'pending'; p: PendingMsg } | { kind: 'day'; label: string; key: string }> = [];
    const newestFirst = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let lastDay = '';
    for (const m of newestFirst) {
      const day = m.createdAt.slice(0, 10);
      if (day !== lastDay) {
        if (lastDay) items.push({ kind: 'day', label: dayLabel(lastDay), key: `day_${lastDay}` });
        lastDay = day;
      }
      items.push({ kind: 'msg', msg: m });
    }
    if (lastDay) items.push({ kind: 'day', label: dayLabel(lastDay), key: `day_${lastDay}` });
    // Pending (optimistic) messages sit at the very bottom, newest last.
    for (const p of [...pending].reverse()) items.unshift({ kind: 'pending', p });
    return items;
  }, [messages, pending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: S.xl, paddingTop: S.lg }}>
        <TopBar title={name} subtitle={locked ? 'Conversation archived' : ctx ? (me.role === 'coach' ? 'Your client' : 'Your coach') : undefined} />
      </View>

      <FlatList
        ref={listRef}
        data={rows}
        inverted
        keyExtractor={(r, i) => (r.kind === 'msg' ? r.msg.id : r.kind === 'pending' ? r.p.tempId : r.key + i)}
        renderItem={({ item }) => {
          if (item.kind === 'day') {
            return (
              <View style={styles.dayRow}>
                <Text style={styles.dayLabel}>{item.label}</Text>
              </View>
            );
          }
          const mine = item.kind === 'msg' ? item.msg.senderId === me.id : true;
          const body = item.kind === 'msg' ? item.msg.body : item.p.body;
          const time = item.kind === 'msg' ? fmtTime(item.msg.createdAt) : '';
          const failed = item.kind === 'pending' && item.p.status === 'failed';
          const sending = item.kind === 'pending' && item.p.status === 'sending';
          return (
            <Pressable disabled={!failed} onPress={() => failed && retry(item.p)} style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, failed ? { borderWidth: 1, borderColor: C.danger } : null]}>
                <Text style={[styles.bubbleText, mine ? { color: '#fff' } : null]}>{body}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  {failed ? <Ionicons name="alert-circle" size={11} color={mine ? '#FFD7DD' : C.danger} style={{ marginRight: 4 }} /> : null}
                  <Text style={[styles.time, mine ? { color: 'rgba(255,255,255,0.75)' } : null]}>
                    {failed ? 'Tap to retry' : sending ? 'Sending…' : time}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingVertical: S.md }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Text style={TYPE.sub}>No messages yet. Say hello 👋</Text>
            </View>
          ) : null
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {locked ? (
          <View style={styles.lockedBar}>
            <Ionicons name="lock-closed" size={15} color={'#9A6712'} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#9A6712', flex: 1 }}>
              Messaging ended with the subscription. Renew to continue.
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor={C.faint}
              multiline
              style={styles.input}
            />
            <Pressable
              onPress={() => send(draft)}
              disabled={!draft.trim()}
              style={[styles.sendBtn, { opacity: draft.trim() ? 1 : 0.45 }]}
            >
              <Ionicons name="send" size={17} color="#fff" />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  dayRow: { alignItems: 'center', paddingVertical: S.md },
  dayLabel: { fontSize: 11.5, fontWeight: '700', color: C.faint, backgroundColor: C.surfaceAlt, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  bubbleRow: { flexDirection: 'row', marginBottom: S.sm, justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.card },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: C.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: C.lineSoft },
  bubbleText: { fontSize: 14.5, lineHeight: 20, color: C.ink, fontWeight: '500' },
  time: { fontSize: 10.5, color: C.faint, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: S.md, paddingHorizontal: S.xl, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.lineSoft },
  input: { flex: 1, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14.5, maxHeight: 110, color: C.ink, fontWeight: '500' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: S.sm },
  lockedBar: { flexDirection: 'row', alignItems: 'center', margin: S.xl, backgroundColor: C.accentSoft, borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.md },
});
