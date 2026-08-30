// One tile in the weekly-photo strip: either an uploaded photo or the
// dashed "add photo" affordance.
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C, R, TYPE } from '../../theme/tokens';

export interface ProgressPhotoTileProps {
  uri: string;
  label: string;
  onPress: () => void;
}

export function ProgressPhotoTile({ uri, label, onPress }: ProgressPhotoTileProps) {
  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <Image source={{ uri }} style={styles.thumb} />
      <Text style={[TYPE.caption, styles.label]}>{label}</Text>
    </Pressable>
  );
}

export interface ProgressPhotoAddTileProps {
  uploading?: boolean;
  onPress: () => void;
}

export function ProgressPhotoAddTile({ uploading, onPress }: ProgressPhotoAddTileProps) {
  return (
    <Pressable onPress={onPress} disabled={uploading} style={styles.add}>
      <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={22} color={C.primary} />
      <Text style={styles.addLabel}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginRight: 12 },
  thumb: { width: 108, height: 135, borderRadius: R.md, backgroundColor: C.surfaceAlt },
  label: { marginTop: 6, textAlign: 'center' },
  add: {
    width: 108, height: 135, borderRadius: R.md, borderWidth: 1.5, borderColor: C.primary,
    borderStyle: 'dashed', backgroundColor: C.primarySoft, alignItems: 'center',
    justifyContent: 'center', marginRight: 12,
  },
  addLabel: { fontSize: 12, fontWeight: '700', color: C.primaryDark, marginTop: 6 },
});
