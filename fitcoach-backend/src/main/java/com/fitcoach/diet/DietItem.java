package com.fitcoach.diet;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One food line. Macros are grams; energy is kcal. Stored inside JSONB. */
@Getter @Setter @NoArgsConstructor
public class DietItem {
    private String food;
    private String qty;
    private int kcal;
    private double protein;
    private double carbs;
    private double fat;
}
