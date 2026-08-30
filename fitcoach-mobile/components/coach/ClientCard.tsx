// One row in the coach's client roster.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CoachClientRow } from '../../lib/api/types';
import { Avatar, Badge, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface ClientCardProps {
  row: CoachClientRow;
  onPress: () => void;
  /** Past (lapsed/cancelled) clients render dimmed. */
  muted?: boolean;
}

export function ClientCard({ row, onPress, muted }: ClientCardProps) {
  const lastActivity = [row.lastMessageAt, row.lastProgressAt].filter(Boolean).sort().pop() ?? null;

  return (
    <Card style={{ marginBottom: S.md, opacity: muted ? 0.75 : 1 }} onPress={onPress}>
      <View style={styles.head}>
        <Avatar name={row.clientName} size={48} />
        <View style={styles.nameWrap}>
          <View style={styles.nameRow}>
            <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{row.clientName}</Text>
            {row.unread > 0 ? (
              <View style={styles.unread}><Text style={styles.unreadText}>{row.unread}</Text></View>
            ) : null}
          </View>
          <Text style={TYPE.sub} numberOfLines={1}>{row.packageTitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.faint} style={{ marginLeft: S.sm }} />
      </View>

      <View style={styles.meta}>
        {row.status === 'active' ? (
          <Badge label={`${row.daysLeft} DAYS LEFT`} tone={row.daysLeft <= 5 ? 'amber' : 'green'} />
        ) : (
          <Badge label={row.status.toUpperCase()} tone={row.status === 'cancelled' ? 'red' : 'amber'} />
        )}
        <View style={styles.planIcons}>
          <Ionicons name={row.hasWorkout ? 'barbell' : 'barbell-outline'} size={14} color={row.hasWorkout ? C.primary : C.faint} style={{ marginRight: 6 }} />
          <Ionicons name={row.hasDiet ? 'nutrition' : 'nutrition-outline'} size={14} color={row.hasDiet ? C.primary : C.faint} />
        </View>
      </View>

      {lastActivity ? (
        <Text style={[TYPE.caption, { marginTop: S.sm }]}>LAST ACTIVITY {timeAgo(lastActivity).toUpperCase()}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  nameWrap: { flex: 1, marginLeft: S.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  unread: {
    backgroundColor: C.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 5, marginRight: 6,
  },
  unreadText: { color: C.white, fontSize: 10.5, fontWeight: '800' },
  meta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: S.md, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
  planIcons: { flexDirection: 'row', alignItems: 'center' },
});
