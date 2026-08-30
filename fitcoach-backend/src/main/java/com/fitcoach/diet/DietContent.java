package com.fitcoach.diet;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The JSONB body of a diet plan. */
@Getter @Setter @NoArgsConstructor
public class DietContent {
    private int targetKcal;
    private List<DietMeal> meals = new ArrayList<>();
    private String notes = "";
}
