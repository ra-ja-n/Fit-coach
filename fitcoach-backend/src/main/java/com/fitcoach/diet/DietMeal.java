package com.fitcoach.diet;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter @NoArgsConstructor
public class DietMeal {
    private String name;
    private String time;
    private List<DietItem> items = new ArrayList<>();
}
