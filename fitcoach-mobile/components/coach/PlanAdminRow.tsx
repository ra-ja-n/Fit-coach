// The coach's "workout / nutrition plan" row for one client: what exists, when
// it changed, and edit / assign-from-library affordances (locked when the
// subscription has ended, since plan updates are writes).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../ui';
import { C, S, TYPE } from '../../theme/tokens';
import { timeAgo } from '../../lib/format';

export interface PlanAdminRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title?: string;
  emptyLabel: string;
  updated?: string;
  canEdit: boolean;
  onEdit: () => void;
  onLibrary: () => void;
}

export function PlanAdminRow({ icon, title, emptyLabel, updated, canEdit, onEdit, onLibrary }: PlanAdminRowProps) {
  return (
    <Card style={{ marginBottom: S.md }}>
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name={icon} size={18} color={C.primary} /></View>
        <View style={styles.body}>
          <Text style={[TYPE.h3, !title && { color: C.sub }]}>{title ?? emptyLabel}</Text>
          <Text style={TYPE.sub}>
            {updated ? `Updated ${timeAgo(updated)}` : 'Create one or assign from your library'}
          </Text>
        </View>
        {canEdit ? (
          <>
            <Pressable hitSlop={8} onPress={onLibrary} style={styles.libraryBtn}>
              <Ionicons name="library-outline" size={17} color={C.primaryDark} />
            </Pressable>
            <Button label={title ? 'Edit' : 'Create'} compact variant={title ? 'outline' : 'primary'} onPress={onEdit} />
          </>
        ) : (
          <Ionicons name="lock-closed-outline" size={16} color={C.faint} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: S.md },
  libraryBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: S.sm },
});
