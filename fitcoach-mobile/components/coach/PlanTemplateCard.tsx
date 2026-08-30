// One entry in the coach's reusable plan library.
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlanTemplate } from '../../lib/api/types';
import { Button, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface PlanTemplateCardProps {
  template: PlanTemplate;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlanTemplateCard({ template: t, onEdit, onDelete }: PlanTemplateCardProps) {
  const confirmDelete = () =>
    Alert.alert('Delete template?', `“${t.title}” will be removed from your library.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={t.kind === 'workout' ? 'barbell-outline' : 'nutrition-outline'} size={17} color={C.primary} />
        </View>
        <View style={styles.body}>
          <Text style={TYPE.h3}>{t.title}</Text>
          <Text style={TYPE.sub} numberOfLines={1}>
            {t.kind === 'workout' ? 'Workout' : 'Nutrition'} · updated {timeAgo(t.updatedAt)}
          </Text>
        </View>
        <Button label="Edit" compact variant="outline" onPress={onEdit} style={{ marginRight: S.sm }} />
        <Button label="Delete" compact variant="dangerSoft" onPress={confirmDelete} />
      </View>
      {t.note ? <Text style={styles.note}>“{t.note}”</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: S.md },
  note: { ...TYPE.sub, marginTop: S.md, fontStyle: 'italic' },
});
