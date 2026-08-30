// The big "your progress" card at the top of a plan: heading, badge, bar, hint.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';

export interface PlanProgressCardProps {
  title: string;
  badge: string;
  tone?: 'green' | 'amber' | 'red' | 'gray' | 'blue';
  /** 0..1 */
  progress: number;
  hint: string;
  children?: React.ReactNode;
}

export function PlanProgressCard({ title, badge, tone = 'blue', progress, hint, children }: PlanProgressCardProps) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <Animated.View entering={FadeInDown.duration(240)}>
      <Card style={{ marginBottom: S.lg }}>
        <View style={styles.head}>
          <Text style={TYPE.h3}>{title}</Text>
          <Badge label={badge} tone={tone} />
        </View>
        <View style={styles.bar}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
        {children}
        <Text style={TYPE.sub}>{hint}</Text>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.surfaceAlt, overflow: 'hidden', marginTop: S.md, marginBottom: S.sm },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.primary },
});
