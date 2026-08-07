import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

let secureStoreSupported: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (secureStoreSupported !== null) return secureStoreSupported;
  try {
    secureStoreSupported = await SecureStore.isAvailableAsync();
  } catch {
    secureStoreSupported = false;
  }
  return secureStoreSupported;
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // Fall back to AsyncStorage if SecureStore throws an error
    }
  }
  return await AsyncStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // Fall back to AsyncStorage if SecureStore throws an error
    }
  }
  await AsyncStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // Fall back to AsyncStorage if SecureStore throws an error
    }
  }
  await AsyncStorage.removeItem(key);
}
