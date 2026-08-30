// Horizontal strip of weekly progress photos. Used on the client's own tracker
// (with an upload tile) and on the coach's client view (read-only).
import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ProgressPhotoAddTile, ProgressPhotoTile } from './ProgressPhotoTile';
import { SectionHeader } from '../ui';
import type { ProgressEntry } from '../../lib/api/types';
import { S, TYPE } from '../../theme/tokens';
import { fmtDay } from '../../lib/format';

export interface ProgressPhotoStripProps {
  entries: ProgressEntry[];
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Render the upload tile; omit for read-only views. */
  onUpload?: () => void;
  uploading?: boolean;
  onOpenPhoto: (uri: string, label: string) => void;
  emptyText?: string;
}

export function ProgressPhotoStrip({ entries, title = 'Weekly photos', actionLabel, onAction, onUpload, uploading, onOpenPhoto, emptyText }: ProgressPhotoStripProps) {
  // Latest photo per check-in, newest entry first.
  const photos = entries.filter((e) => e.photoUrls.length > 0);
  const showEmpty = photos.length === 0 && !onUpload && !!emptyText;

  return (
    <>
      <SectionHeader title={title} action={actionLabel} onAction={onAction} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripInner}>
        {onUpload ? <ProgressPhotoAddTile uploading={uploading} onPress={onUpload} /> : null}
        {photos.map((e) => (
          <ProgressPhotoTile
            key={e.id}
            uri={e.photoUrls[e.photoUrls.length - 1]!}
            label={fmtDay(e.date)}
            onPress={() => onOpenPhoto(e.photoUrls[e.photoUrls.length - 1]!, fmtDay(e.date))}
          />
        ))}
        {showEmpty ? <Text style={styles.empty}>{emptyText}</Text> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -S.xl },
  stripInner: { paddingHorizontal: S.xl },
  empty: { ...TYPE.sub, paddingVertical: S.lg },
});
