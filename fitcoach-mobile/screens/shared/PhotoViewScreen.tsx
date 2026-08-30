import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../theme/tokens';
import type { ClientStackParamList, CoachStackParamList } from '../../navigation/types';

/** Reachable from both the client and coach stacks; both declare PhotoView. */
type ParamList = ClientStackParamList & CoachStackParamList;

export default function PhotoViewScreen({ route, navigation }: NativeStackScreenProps<ParamList, 'PhotoView'>) {
  const { uri, label } = route.params;
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.img} contentFit="contain" />
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => navigation.goBack()} style={styles.close} hitSlop={10}>
        <Ionicons name="close" size={20} color={C.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.photoBackdrop, alignItems: 'center', justifyContent: 'center' },
  img: { width: '92%', height: '78%', borderRadius: 20 },
  label: { marginTop: 16, fontSize: 15, fontWeight: '700', color: C.ink },
  close: { position: 'absolute', top: 56, right: 20, width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
});
