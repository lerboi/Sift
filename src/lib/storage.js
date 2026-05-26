import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

// per docs/architecture/frontend.md § session storage — the 2KB problem:
// supabase JWTs can exceed secure-store's 2048-byte ceiling, so the session
// blob lives in AsyncStorage encrypted with an aes-256-gcm key that itself
// lives in secure-store (hardware-backed where available).

const KEY_NAME = 'sift.session.aes_key.v1';
const STORAGE_PREFIX = 'sift.session.';

let cachedKey = null;

async function getOrCreateKey() {
  if (cachedKey) return cachedKey;
  let hex = await SecureStore.getItemAsync(KEY_NAME);
  if (!hex) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    hex = bytesToHex(bytes);
    await SecureStore.setItemAsync(KEY_NAME, hex);
  }
  cachedKey = hexToBytes(hex);
  return cachedKey;
}

async function encrypt(plaintext, key) {
  const nonce = await Crypto.getRandomBytesAsync(12);
  const ct = gcm(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  // payload: nonceHex:ciphertextHex
  return `${bytesToHex(nonce)}:${bytesToHex(ct)}`;
}

function decrypt(payload, key) {
  const [nonceHex, ctHex] = payload.split(':');
  if (!nonceHex || !ctHex) throw new Error('storage: malformed payload');
  const plain = gcm(key, hexToBytes(nonceHex)).decrypt(hexToBytes(ctHex));
  return new TextDecoder().decode(plain);
}

export const encryptedSessionStorage = {
  async getItem(key) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
      if (!raw) return null;
      const k = await getOrCreateKey();
      return decrypt(raw, k);
    } catch {
      // unrecoverable read (corrupt payload, key rotation drift) — treat as
      // signed-out so the next launch routes the user through sign-in cleanly.
      return null;
    }
  },
  async setItem(key, value) {
    const k = await getOrCreateKey();
    const ct = await encrypt(value, k);
    await AsyncStorage.setItem(STORAGE_PREFIX + key, ct);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(STORAGE_PREFIX + key);
  },
};
