// One line inside a training day: tick box, name, sets x reps, rest chip.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutExercise } from '../../lib/api/types';
import { C, R, S } from '../../theme/tokens';
import { CheckBox } from './CheckBox';

export interface ExerciseRowProps {
  exercise: WorkoutExercise;
  checked: boolean;
  canCheck: boolean;
  /** Draws the hairline that separates this row from the one above. */
  first?: boolean;
  onToggle: () => void;
}

export function ExerciseRow({ exercise, checked, canCheck, first, onToggle }: ExerciseRowProps) {
  return (
    <View style={[styles.row, !first && styles.rowDivided]}>
      <CheckBox checked={checked} disabled={!canCheck} onPress={onToggle} />
      <View style={styles.nameWrap}>
        <Text style={[styles.name, checked && styles.nameDone]}>{exercise.name}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{exercise.sets} × {exercise.reps}</Text>
        <View style={styles.restChip}>
          <Ionicons name="timer-outline" size={11} color={C.sub} />
          <Text style={styles.restText}>{exercise.restSec}s</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowDivided: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  nameWrap: { flex: 1, marginLeft: S.md },
  name: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  nameDone: { textDecorationLine: 'line-through', color: C.faint },
  meta: { alignItems: 'flex-end' },
  metaText: { fontSize: 13.5, fontWeight: '700', color: C.primary },
  restChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceAlt,
    borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  restText: { fontSize: 10.5, fontWeight: '700', color: C.sub, marginLeft: 3 },
});
