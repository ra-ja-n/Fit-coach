// One chat bubble. Handles the three visual states a message can be in:
// delivered (with a timestamp), still sending, or failed and tappable to retry.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S, SHADOW } from '../../theme/tokens';

export type MessageState = 'sent' | 'sending' | 'failed';

export interface MessageBubbleProps {
  body: string;
  /** Rendered right-aligned when this is the signed-in user's own message. */
  mine: boolean;
  time?: string;
  state?: MessageState;
  onRetry?: () => void;
}

export function MessageBubble({ body, mine, time = '', state = 'sent', onRetry }: MessageBubbleProps) {
  const failed = state === 'failed';
  const sending = state === 'sending';

  return (
    <Pressable disabled={!failed} onPress={() => failed && onRetry?.()} style={[styles.row, mine && styles.rowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, failed && styles.bubbleFailed]}>
        <Text style={[styles.text, mine && { color: C.white }]}>{body}</Text>
        <View style={styles.footer}>
          {failed ? <Ionicons name="alert-circle" size={11} color={mine ? C.dangerOnPrimary : C.danger} style={{ marginRight: 4 }} /> : null}
          <Text style={[styles.time, mine && { color: 'rgba(255,255,255,0.75)' }]}>
            {failed ? 'Tap to retry' : sending ? 'Sending…' : time}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ChatDaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.dayRow}>
      <Text style={styles.dayLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: S.sm, justifyContent: 'flex-start' },
  rowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: R.lg, paddingHorizontal: 14, paddingVertical: 10, ...SHADOW.card },
  bubbleMine: { backgroundColor: C.primary, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: C.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: C.lineSoft },
  bubbleFailed: { borderWidth: 1, borderColor: C.danger },
  text: { fontSize: 14.5, lineHeight: 20, color: C.ink, fontWeight: '500' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  time: { fontSize: 10.5, color: C.faint, fontWeight: '600' },
  dayRow: { alignItems: 'center', paddingVertical: S.md },
  dayLabel: {
    fontSize: 11.5, fontWeight: '700', color: C.faint, backgroundColor: C.surfaceAlt,
    borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden',
  },
});
