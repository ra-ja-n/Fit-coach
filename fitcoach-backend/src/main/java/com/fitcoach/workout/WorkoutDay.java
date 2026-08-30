package com.fitcoach.workout;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class WorkoutDay {
    private String name;
    private String focus;
    private List<WorkoutExercise> exercises = new ArrayList<>();
}
