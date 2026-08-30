// The coach's revenue header: this month, lifetime, active clients, and the
// most recent captured payments.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RevenueSummary } from '../../lib/api/types';
import { Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';

export interface RevenueSummaryTileProps {
  revenue?: RevenueSummary;
  recentLimit?: number;
}

export function RevenueSummaryTile({ revenue, recentLimit = 3 }: RevenueSummaryTileProps) {
  const recent = (revenue?.recent ?? []).slice(0, recentLimit);
  return (
    <Card>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.caption}>THIS MONTH</Text>
          <Text style={styles.money}>{revenue ? money(revenue.thisMonthCents) : '—'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.caption}>LIFETIME</Text>
          <Text style={styles.money}>{revenue ? money(revenue.totalCents) : '—'}</Text>
        </View>
        <View style={{ flex: 0.8 }}>
          <Text style={TYPE.caption}>CLIENTS</Text>
          <Text style={styles.money}>{revenue?.activeClients ?? '—'}</Text>
        </View>
      </View>

      {recent.length > 0 ? (
        <View style={styles.recent}>
          {recent.map((r) => (
            <View key={r.id} style={styles.payRow}>
              <Text style={[TYPE.sub, { flex: 1 }]} numberOfLines={1}>{r.clientName} · {r.packageTitle}</Text>
              <Text style={styles.payAmount}>{money(r.amountCents)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  money: { fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 4 },
  recent: { marginTop: S.lg, paddingTop: S.md, borderTopWidth: 1, borderTopColor: C.lineSoft },
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  payAmount: { fontWeight: '700', color: C.primary, fontSize: 13.5 },
});
