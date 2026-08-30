// Plan adherence pills for a client — how much of each plan they've checked off.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '../../theme/tokens';

export interface AdherenceChipsProps {
  workoutChecked: number;
  workoutTotal: number;
  dietChecked: number;
  dietTotal: number;
}

export function AdherenceChips({ workoutChecked, workoutTotal, dietChecked, dietTotal }: AdherenceChipsProps) {
  if (workoutTotal <= 0 && dietTotal <= 0) return null;

  return (
    <View style={styles.row}>
      {workoutTotal > 0 && (
        <View style={styles.chip}>
          <Ionicons name="barbell-outline" size={13} color={C.primary} style={styles.icon} />
          <Text style={styles.text}>Workout {workoutChecked}/{workoutTotal} checked</Text>
        </View>
      )}
      {dietTotal > 0 && (
        <View style={styles.chip}>
          <Ionicons name="nutrition-outline" size={13} color={C.blue} style={styles.icon} />
          <Text style={styles.text}>Diet {dietChecked}/{dietTotal} checked</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.md },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.full, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 7, marginRight: S.sm, marginBottom: S.sm },
  icon: { marginRight: 6 },
  text: { fontSize: 12, fontWeight: '700', color: C.sub },
});
