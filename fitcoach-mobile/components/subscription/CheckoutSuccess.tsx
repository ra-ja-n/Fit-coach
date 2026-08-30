// Full-screen confirmation shown once the webhook has activated the subscription.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';

export interface CheckoutSuccessProps {
  coachName: string;
  onDone: () => void;
}

export function CheckoutSuccess({ coachName, onDone }: CheckoutSuccessProps) {
  return (
    <View style={styles.center}>
      <View style={styles.icon}><Ionicons name="checkmark" size={34} color={C.white} /></View>
      <Text style={[TYPE.h1, styles.title]}>You're in! 🎉</Text>
      <Text style={styles.body}>
        Payment confirmed and your subscription with {coachName} is active. Your plans and private chat are ready.
      </Text>
      <Button label="Go to my dashboard" style={styles.button} onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: S.xxl },
  icon: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', marginTop: S.xl },
  body: { ...TYPE.sub, textAlign: 'center', marginTop: S.sm, lineHeight: 21, maxWidth: 300 },
  button: { marginTop: S.xxl, alignSelf: 'center' },
});
