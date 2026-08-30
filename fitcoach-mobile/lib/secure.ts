// Secure storage wrapper. Tokens ONLY ever live here (expo-secure-store on
// device). Web has no secure enclave, so it falls back to AsyncStorage —
// never used for secrets on a real device build.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';
const WEB_PREFIX = 'fc.secure.';

export async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(WEB_PREFIX + key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function secureGet(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(WEB_PREFIX + key);
  return SecureStore.getItemAsync(key);
}

export async function secureDelete(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(WEB_PREFIX + key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
