package com.fitcoach.workout;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Stored inside the plan's JSONB {@code content} — never its own table. */
@Getter @Setter @NoArgsConstructor
public class WorkoutExercise {
    private String name;
    private int sets;
    private String reps;
    private int restSec;
}
