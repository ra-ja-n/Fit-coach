package com.fitcoach.plan;

import com.fitcoach.diet.DietPlanDto;
import com.fitcoach.workout.WorkoutPlanDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Everything the client's plan tab needs in one round trip, plus the gamified
 * check-offs. Nulls are meaningful: a pair simply has no plan of that kind yet.
 */
public record PlansBundleDto(
        WorkoutPlanDto workout,
        DietPlanDto diet,
        List<CheckRef> workoutChecks,
        List<CheckRef> dietChecks) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CheckRef(Integer day, Integer exercise, Integer meal, Integer item) {
        public static CheckRef workout(int day, int exercise) {
            return new CheckRef(day, exercise, null, null);
        }
        public static CheckRef diet(int meal, int item) {
            return new CheckRef(null, null, meal, item);
        }
    }
}
