import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

// per docs/architecture/frontend.md § session storage — the 2KB problem:
// supabase JWTs can exceed secure-store's 2048-byte ceiling, so the session
// blob lives in AsyncStorage encrypted with an aes-256-gcm key that itself
// lives in secure-store (hardware-backed where available).
//
// expo-go on sdk 53+ has stripped native support for expo-secure-store, so we
// detect at runtime and fall back to a plain AsyncStorage adapter for the key.
// not encrypted in the fallback path, but unblocks development-in-expo-go.
// dev-client / production builds keep full secure-store + encryption.

const KEY_NAME = 'sift.session.aes_key.v1';
const STORAGE_PREFIX = 'sift.session.';
const FALLBACK_KEY_STORAGE_PREFIX = 'sift.fallback.';

let cachedKey = null;
let secureStoreAvailable = null;

async function isSecureStoreAvailable() {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    // round-trip a probe value. native module missing → throws synchronously
    // (TypeError: getValueWithKeyAsync is not a function) or via promise.
    await SecureStore.getItemAsync('sift.secure_store_probe');
    secureStoreAvailable = true;
  } catch (e) {
    if (__DEV__) console.warn('[storage] secure-store unavailable, falling back to AsyncStorage', e?.message);
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

async function readKeyHex() {
  if (await isSecureStoreAvailable()) {
    return SecureStore.getItemAsync(KEY_NAME);
  }
  return AsyncStorage.getItem(FALLBACK_KEY_STORAGE_PREFIX + KEY_NAME);
}

async function writeKeyHex(hex) {
  if (await isSecureStoreAvailable()) {
    await SecureStore.setItemAsync(KEY_NAME, hex);
    return;
  }
  await AsyncStorage.setItem(FALLBACK_KEY_STORAGE_PREFIX + KEY_NAME, hex);
}

async function getOrCreateKey() {
  if (cachedKey) return cachedKey;
  let hex = await readKeyHex();
  if (!hex) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    hex = bytesToHex(bytes);
    await writeKeyHex(hex);
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
