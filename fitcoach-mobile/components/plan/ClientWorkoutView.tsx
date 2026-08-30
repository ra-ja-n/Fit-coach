// The client's read/execute view of a workout plan: progress card + one card
// per training day, with check-offs.
import React from 'react';
import { PlanDayCard } from './PlanDayCard';
import { PlanProgressCard } from './PlanProgressCard';
import type { WorkoutPlan } from '../../lib/api/types';

export interface ClientWorkoutViewProps {
  workout: WorkoutPlan;
  /** Check-offs the server already recorded for this plan. */
  checks: { day: number; exercise: number }[];
  canCheck: boolean;
  onToggle: (day: number, exercise: number) => void;
}

export function ClientWorkoutView({ workout, checks, canCheck, onToggle }: ClientWorkoutViewProps) {
  const total = workout.days.reduce((a, d) => a + d.exercises.length, 0);
  const done = checks.length;
  const complete = total > 0 && done === total;

  return (
    <>
      <PlanProgressCard
        title="Your progress"
        badge={`${done}/${total} DONE`}
        tone={complete ? 'green' : 'blue'}
        progress={total ? done / total : 0}
        hint={complete ? 'Program complete — champion status 🏆' : 'Tick off each exercise as you finish it.'}
      />
      {workout.days.map((day, di) => (
        <PlanDayCard
          key={day.name + di}
          day={day}
          index={di}
          checkedExercises={checks.filter((c) => c.day === di).map((c) => c.exercise)}
          canCheck={canCheck}
          onToggle={(ei) => onToggle(di, ei)}
        />
      ))}
    </>
  );
}
