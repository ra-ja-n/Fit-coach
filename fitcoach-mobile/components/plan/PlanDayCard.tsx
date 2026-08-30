// One training day: numbered badge, focus, per-day completion bar and its
// exercises.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutDay } from '../../lib/api/types';
import { Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { ExerciseRow } from './ExerciseRow';

export interface PlanDayCardProps {
  day: WorkoutDay;
  index: number;
  /** Exercise indices (within this day) the client has ticked. */
  checkedExercises: number[];
  canCheck: boolean;
  onToggle: (exerciseIndex: number) => void;
}

export function PlanDayCard({ day, index, checkedExercises, canCheck, onToggle }: PlanDayCardProps) {
  const done = checkedExercises.length;
  const total = day.exercises.length;
  const complete = total > 0 && done === total;
  const pct = total ? done / total : 0;

  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.head}>
        <View style={[styles.badge, complete && styles.badgeDone]}>
          {complete
            ? <Ionicons name="checkmark" size={16} color={C.white} />
            : <Text style={styles.badgeText}>{index + 1}</Text>}
        </View>
        <View style={styles.headText}>
          <Text style={TYPE.h3}>{day.name}</Text>
          <Text style={TYPE.sub}>{day.focus}</Text>
        </View>
        <Text style={[TYPE.caption, { color: complete ? C.primary : C.faint }]}>{done}/{total}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>

      {day.exercises.map((exercise, ei) => (
        <ExerciseRow
          key={`${day.name}-${ei}`}
          exercise={exercise}
          first={ei === 0}
          checked={checkedExercises.includes(ei)}
          canCheck={canCheck}
          onToggle={() => onToggle(ei)}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  badge: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: C.primary },
  badgeText: { color: C.primaryDark, fontWeight: '800', fontSize: 14 },
  headText: { marginLeft: S.md, flex: 1 },
  bar: { height: 4, borderRadius: 2, backgroundColor: C.surfaceAlt, overflow: 'hidden', marginBottom: S.sm },
  fill: { height: 4, borderRadius: 2, backgroundColor: C.primary },
});
