import AsyncStorage from "@react-native-async-storage/async-storage"
import type { StorageAdapter } from "../types"

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function asyncStorageAdapter(keyPrefix = "echidna:"): StorageAdapter {
  return {
    async get(key: string): Promise<Uint8Array | null> {
      const value = await AsyncStorage.getItem(keyPrefix + key)
      return value !== null ? fromBase64(value) : null
    },
    async set(key: string, value: Uint8Array): Promise<void> {
      await AsyncStorage.setItem(keyPrefix + key, toBase64(value))
    },
    async delete(key: string): Promise<void> {
      await AsyncStorage.removeItem(keyPrefix + key)
    },
    async list(prefix = ""): Promise<string[]> {
      const allKeys = await AsyncStorage.getAllKeys()
      return allKeys
        .filter((k) => k.startsWith(keyPrefix))
        .map((k) => k.slice(keyPrefix.length))
        .filter((k) => k.startsWith(prefix))
    },
  }
}
