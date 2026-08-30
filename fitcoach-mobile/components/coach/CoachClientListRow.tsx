// Compact coach-side list row: a client thread in the inbox. The whole row is
// the tap target (an earlier version layered an invisible Pressable over the
// row to get the same effect).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatThreadRow } from '../../lib/api/types';
import { Avatar } from '../ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface CoachClientListRowProps {
  thread: ChatThreadRow;
  onPress: () => void;
}

export function CoachClientListRow({ thread, onPress }: CoachClientListRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !thread.active && styles.rowInactive]}>
      <Avatar name={thread.clientName} size={48} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{thread.clientName}</Text>
          {!thread.active ? <Ionicons name="lock-closed" size={13} color={C.faint} style={{ marginRight: 6 }} /> : null}
          {thread.lastAt ? <Text style={TYPE.caption}>{timeAgo(thread.lastAt)}</Text> : null}
        </View>
        <Text style={[TYPE.sub, { marginTop: 2 }]} numberOfLines={1}>{thread.lastMessage}</Text>
      </View>
      {thread.unread > 0 ? (
        <View style={styles.unread}><Text style={styles.unreadText}>{thread.unread}</Text></View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ marginLeft: S.sm }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.lg,
    borderWidth: 1, borderColor: C.lineSoft, padding: S.lg, marginBottom: S.md, overflow: 'hidden',
  },
  rowInactive: { opacity: 0.72 },
  body: { flex: 1, marginLeft: S.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  unread: {
    backgroundColor: C.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { color: C.white, fontSize: 11, fontWeight: '800' },
});
