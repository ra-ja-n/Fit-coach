// Order summary on the checkout screen: what's being bought, from whom, for how
// much, and which features come with it.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui';
import type { Package } from '../../lib/api/types';
import { C, S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';

export interface PackageReviewCardProps {
  pkg: Package;
  coachName: string;
}

export function PackageReviewCard({ pkg, coachName }: PackageReviewCardProps) {
  return (
    <Card>
      <Text style={TYPE.caption}>PACKAGE</Text>
      <Text style={[TYPE.h2, { marginTop: 4 }]}>{pkg.title}</Text>
      <Text style={[TYPE.sub, { marginTop: 2 }]}>by {coachName} · {pkg.durationDays} days</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{money(pkg.priceCents)}</Text>
        <Text style={TYPE.caption}>ONE-TIME · FULL ACCESS</Text>
      </View>
      <View style={{ marginTop: S.md }}>
        {pkg.features.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={C.primary} style={styles.featureIcon} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: S.lg, paddingTop: S.lg, borderTopWidth: 1, borderTopColor: C.lineSoft },
  price: { fontSize: 26, fontWeight: '800', color: C.ink },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  featureIcon: { marginRight: 8 },
  featureText: { fontSize: 13.5, color: C.sub, fontWeight: '500' },
});
