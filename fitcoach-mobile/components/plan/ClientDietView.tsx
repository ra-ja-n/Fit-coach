// The client's read/execute view of a nutrition plan: macro roll-up, one card
// per meal, and the coach's notes.
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DietMealCard } from './DietMealCard';
import { MacroStat } from './MacroStat';
import { PlanProgressCard } from './PlanProgressCard';
import type { DietPlan } from '../../lib/api/types';
import { C, R, S } from '../../theme/tokens';

export interface ClientDietViewProps {
  diet: DietPlan;
  /** Check-offs the server already recorded for this plan. */
  checks: { meal: number; item: number }[];
  canCheck: boolean;
  onToggle: (meal: number, item: number) => void;
}

export function ClientDietView({ diet, checks, canCheck, onToggle }: ClientDietViewProps) {
  const totals = useMemo(() => {
    let kcal = 0, protein = 0, carbs = 0, fat = 0, count = 0;
    diet.meals.forEach((m) => m.items.forEach((it) => {
      kcal += it.kcal; protein += it.protein ?? 0; carbs += it.carbs ?? 0; fat += it.fat ?? 0; count++;
    }));
    return { kcal, protein, carbs, fat, count };
  }, [diet]);

  return (
    <>
      <PlanProgressCard
        title="Daily summary"
        badge={`${totals.kcal} / ${diet.targetKcal} KCAL`}
        tone="green"
        progress={diet.targetKcal ? totals.kcal / diet.targetKcal : 0}
        hint="Tick each food as you eat it to keep score of your day."
      >
        <View style={styles.macroRow}>
          <MacroStat label="Protein" value={`${totals.protein}g`} color={C.primary} />
          <MacroStat label="Carbs" value={`${totals.carbs}g`} color={C.blue} />
          <MacroStat label="Fat" value={`${totals.fat}g`} color={C.accent} />
          <MacroStat label="Checked" value={`${checks.length}/${totals.count}`} color={C.ink} />
        </View>
      </PlanProgressCard>

      {diet.meals.map((meal, mi) => (
        <DietMealCard
          key={meal.name + mi}
          meal={meal}
          checkedItems={checks.filter((c) => c.meal === mi).map((c) => c.item)}
          canCheck={canCheck}
          onToggle={(ii) => onToggle(mi, ii)}
        />
      ))}

      {diet.notes ? (
        <View style={styles.notesBox}>
          <Ionicons name="bulb-outline" size={16} color={C.accentInk} style={styles.notesIcon} />
          <Text style={styles.notesText}>{diet.notes}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  macroRow: { flexDirection: 'row', marginTop: S.md, marginBottom: S.sm },
  notesBox: { flexDirection: 'row', backgroundColor: C.accentSoft, borderRadius: R.lg, padding: S.lg, borderWidth: 1, borderColor: C.accentLine },
  notesIcon: { marginRight: 8, marginTop: 2 },
  notesText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: C.accentDeep, fontWeight: '500' },
});
