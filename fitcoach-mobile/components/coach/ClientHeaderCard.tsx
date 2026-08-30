// Coach view of a client's subscription card, including the read-only banner
// that appears when the subscription has ended.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Card } from '../ui';
import { C, R, S, TYPE } from '../../theme/tokens';
import { fmtDate } from '../../lib/format';

export interface ClientHeaderCardProps {
  clientName: string;
  packageTitle: string;
  startDate: string;
  endDate: string;
  /** 'active' | 'expired' | 'cancelled' */
  status: string;
}

export function ClientHeaderCard({ clientName, packageTitle, startDate, endDate, status }: ClientHeaderCardProps) {
  const isActive = status === 'active';
  const tone = isActive ? 'green' : status === 'cancelled' ? 'red' : 'amber';

  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={clientName} size={46} />
        <View style={styles.body}>
          <Text style={TYPE.h3}>{packageTitle}</Text>
          <Text style={TYPE.sub}>{fmtDate(startDate)} → {fmtDate(endDate)}</Text>
        </View>
        <Badge label={status.toUpperCase()} tone={tone} />
      </View>
      {!isActive && (
        <View style={styles.readOnlyBar}>
          <Ionicons name="lock-closed-outline" size={13} color={C.accentInk} style={styles.readOnlyIcon} />
          <Text style={styles.readOnlyText}>
            Subscription ended — history is read-only. Messaging and plan updates are disabled.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, marginLeft: S.md },
  readOnlyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: R.sm, paddingHorizontal: S.md, paddingVertical: 9, marginTop: S.md },
  readOnlyIcon: { marginRight: 7 },
  readOnlyText: { fontSize: 12, fontWeight: '700', color: C.accentInk, flex: 1 },
});
