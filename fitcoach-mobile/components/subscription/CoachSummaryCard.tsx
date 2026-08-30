// The client's "your coach" card: who they are, how much of the subscription
// period is left, and the two actions that matter (message, view profile).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Button, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';

export interface CoachSummaryCardProps {
  coachName: string;
  specialties: string[];
  packageTitle: string;
  daysLeft: number;
  /** 0..1 — share of the subscription period remaining. */
  progress: number;
  active: boolean;
  onMessage: () => void;
  onViewProfile: () => void;
}

/** Days at which the "ending soon" nudge starts. */
const RENEW_NUDGE_DAYS = 5;

export function CoachSummaryCard({ coachName, specialties, packageTitle, daysLeft, progress, active, onMessage, onViewProfile }: CoachSummaryCardProps) {
  const endingSoon = daysLeft <= RENEW_NUDGE_DAYS;

  return (
    <Card style={{ marginTop: active ? S.xs : S.lg }}>
      <View style={styles.row}>
        <Avatar name={coachName} size={52} />
        <View style={styles.identity}>
          <Text style={TYPE.caption}>{active ? 'YOUR COACH' : 'FORMER COACH'}</Text>
          <Text style={[TYPE.h3, { marginTop: 1 }]}>{coachName}</Text>
          <Text style={TYPE.sub} numberOfLines={1}>{specialties.join(' · ')}</Text>
        </View>
        {active ? <Badge label="ACTIVE" tone="green" /> : <Badge label="READ-ONLY" tone="amber" />}
      </View>

      {active && (
        <View style={{ marginTop: S.lg }}>
          <View style={styles.meterHead}>
            <Text style={TYPE.caption}>{packageTitle.toUpperCase()}</Text>
            <Text style={[TYPE.caption, { color: endingSoon ? C.accentInk : C.faint }]}>{daysLeft} DAYS LEFT</Text>
          </View>
          <View style={styles.bar}><View style={[styles.barFill, { width: `${progress * 100}%` }]} /></View>
          {endingSoon && (
            <Pressable onPress={onViewProfile} style={styles.nudge}>
              <Text style={styles.nudgeText}>Ending soon — renew now →</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.actions}>
        <Button
          label={active ? 'Message' : 'Messaging locked'}
          icon={active ? 'chatbubble-outline' : 'lock-closed-outline'}
          variant={active ? 'primary' : 'soft'}
          compact
          style={styles.action}
          onPress={onMessage}
        />
        <Button label="View profile" variant="outline" compact style={styles.action} onPress={onViewProfile} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  identity: { flex: 1, marginLeft: S.md },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.surfaceAlt, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: C.primary },
  nudge: { marginTop: S.sm },
  nudgeText: { fontSize: 12.5, fontWeight: '700', color: C.accentInk },
  actions: { flexDirection: 'row', marginTop: S.lg },
  action: { flex: 1, marginRight: S.sm },
});
