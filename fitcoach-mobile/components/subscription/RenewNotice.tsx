// "Your plan ended" banner shown on the client dashboard when the subscription
// has lapsed. History stays readable; messaging and updates are gone.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui';
import { C, R, S } from '../../theme/tokens';
import { fmtDate } from '../../lib/format';

export interface RenewNoticeProps {
  coachName: string;
  endDate: string;
  onRenew: () => void;
}

export function RenewNotice({ coachName, endDate, onRenew }: RenewNoticeProps) {
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={styles.card}>
      <Ionicons name="hourglass-outline" size={20} color={C.accentInk} />
      <Text style={styles.text}>
        Your plan with {coachName} ended {fmtDate(endDate)}. Plans & history stay readable — renew to restore messaging and updates.
      </Text>
      <Button label="Renew" compact style={styles.button} onPress={onRenew} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.accentSoft, borderRadius: R.lg, padding: S.lg, marginTop: S.xl, borderWidth: 1, borderColor: C.accentLine },
  text: { fontSize: 13.5, lineHeight: 19, color: C.accentDeep, fontWeight: '600', marginTop: S.sm },
  button: { alignSelf: 'flex-start', marginTop: S.md },
});
