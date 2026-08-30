// One meal: header with kcal/protein totals, then its tickable food items.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DietMeal } from '../../lib/api/types';
import { Badge, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { CheckBox } from './CheckBox';
import { MacroChip } from './MacroChip';

export interface DietMealCardProps {
  meal: DietMeal;
  /** Item indices (within this meal) the client has ticked. */
  checkedItems: number[];
  canCheck: boolean;
  onToggle: (itemIndex: number) => void;
}

export function DietMealCard({ meal, checkedItems, canCheck, onToggle }: DietMealCardProps) {
  const mealKcal = meal.items.reduce((a, i) => a + i.kcal, 0);
  const mealProtein = meal.items.reduce((a, i) => a + (i.protein ?? 0), 0);

  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={TYPE.h3}>{meal.name}</Text>
          {meal.time ? <Text style={TYPE.sub}>{meal.time}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Badge label={`${mealKcal} kcal`} tone="blue" />
          <Text style={[TYPE.caption, { marginTop: 4 }]}>P {mealProtein}g</Text>
        </View>
      </View>

      {meal.items.map((item, ii) => {
        const checked = checkedItems.includes(ii);
        return (
          <View key={`${meal.name}-${ii}`} style={[styles.row, ii > 0 && styles.rowDivided]}>
            <CheckBox checked={checked} disabled={!canCheck} onPress={() => onToggle(ii)} />
            <View style={styles.itemWrap}>
              <Text style={[styles.itemName, checked && styles.itemDone]}>{item.food}</Text>
              <Text style={TYPE.sub}>{item.qty}</Text>
              <View style={{ flexDirection: 'row', marginTop: 5 }}>
                <MacroChip label={`P ${item.protein ?? 0}g`} color={C.primary} />
                <MacroChip label={`C ${item.carbs ?? 0}g`} color={C.blue} />
                <MacroChip label={`F ${item.fat ?? 0}g`} color={C.accent} />
              </View>
            </View>
            <Text style={styles.kcal}>{item.kcal}</Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: S.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowDivided: { borderTopWidth: 1, borderTopColor: C.lineSoft },
  itemWrap: { flex: 1, marginLeft: S.md },
  itemName: { fontSize: 14.5, fontWeight: '600', color: C.ink },
  itemDone: { textDecorationLine: 'line-through', color: C.faint },
  kcal: { fontSize: 14, fontWeight: '800', color: C.blue, marginLeft: S.sm },
});
