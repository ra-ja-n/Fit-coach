// One package in the coach's business screen, with edit/delete.
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Package } from '../../lib/api/types';
import { Button, Card } from '../ui';
import { S, TYPE } from '../../theme/tokens';
import { money } from '../../lib/format';

export interface PackageCardProps {
  pkg: Package;
  onEdit: () => void;
  onDelete: () => void;
}

export function PackageCard({ pkg, onEdit, onDelete }: PackageCardProps) {
  const confirmDelete = () =>
    Alert.alert('Delete package?', 'Only possible while nobody has purchased it.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.h3}>{pkg.title}</Text>
          <Text style={TYPE.sub}>{money(pkg.priceCents)} · {pkg.durationDays} days</Text>
        </View>
        <Button label="Edit" compact variant="outline" onPress={onEdit} style={{ marginRight: S.sm }} />
        <Button label="Delete" compact variant="dangerSoft" onPress={confirmDelete} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
