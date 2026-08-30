// Composer at the bottom of a conversation, or the locked notice shown when the
// subscription has ended (messaging is a write, so it stops with the plan).
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '../../theme/tokens';

export interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
}

export function ChatInputBar({ value, onChangeText, onSend, placeholder = 'Write a message…' }: ChatInputBarProps) {
  const canSend = value.trim().length > 0;
  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        multiline
        style={styles.input}
      />
      <Pressable onPress={onSend} disabled={!canSend} style={[styles.send, { opacity: canSend ? 1 : 0.45 }]}>
        <Ionicons name="send" size={17} color={C.white} />
      </Pressable>
    </View>
  );
}

export function ChatLockedBar({ message = 'Messaging ended with the subscription. Renew to continue.' }: { message?: string }) {
  return (
    <View style={styles.locked}>
      <Ionicons name="lock-closed" size={15} color={C.accentInk} style={{ marginRight: 8 }} />
      <Text style={styles.lockedText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: S.md, paddingHorizontal: S.xl,
    backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.lineSoft,
  },
  input: {
    flex: 1, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14.5, maxHeight: 110, color: C.ink, fontWeight: '500',
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginLeft: S.sm },
  locked: {
    flexDirection: 'row', alignItems: 'center', margin: S.xl, backgroundColor: C.accentSoft,
    borderRadius: R.md, paddingHorizontal: S.lg, paddingVertical: S.md,
  },
  lockedText: { fontSize: 13, fontWeight: '600', color: C.accentInk, flex: 1 },
});
