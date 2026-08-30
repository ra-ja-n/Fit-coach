// FitCoach UI kit — light, clean, generous whitespace. No gradients, no blur.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { C, S, TYPE } from '../../theme/tokens';

const styles = StyleSheet.create({
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginRight: S.md },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.xl },
  topbarLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: S.md },
  topbarSub: { ...TYPE.caption, marginTop: 2 },
});

export function TopBar({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: React.ReactNode; back?: boolean }) {
  const nav = useNavigation();
  return (
    <View style={styles.topbar}>
      <View style={styles.topbarLeft}>
        {back && nav.canGoBack() ? (
          <Pressable hitSlop={10} onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </Pressable>
        ) : null}
        <View>
          <Text style={TYPE.h2} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.topbarSub}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}
