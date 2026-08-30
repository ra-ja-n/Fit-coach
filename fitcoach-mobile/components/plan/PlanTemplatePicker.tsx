// The coach's template library row — pick one to copy into a client's plan.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlanTemplate } from '../../lib/api/types';
import { Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';

export interface PlanTemplatePickerProps {
  template: PlanTemplate;
  busy?: boolean;
  onAssign: () => void;
}

export function PlanTemplatePicker({ template, busy, onAssign }: PlanTemplatePickerProps) {
  return (
    <Card style={{ marginBottom: S.md }} onPress={onAssign}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.h3}>{template.title}</Text>
          {template.note ? <Text style={[TYPE.sub, { marginTop: 2 }]} numberOfLines={2}>{template.note}</Text> : null}
        </View>
        <Ionicons
          name={busy ? 'hourglass-outline' : 'chevron-forward'}
          size={18}
          color={busy ? C.primary : C.faint}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
