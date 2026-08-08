// AES-GCM Encryption for localStorage data at rest
// Uses PBKDF2 to derive an encryption key from the user's Firebase UID + PIN
// Even if localStorage is accessed, data is encrypted and unreadable without the key

const SALT = new TextEncoder().encode('__aira_encryption_salt_2024_v1__');
const KEY_ITERATIONS = 600000; // OWASP recommended minimum for PBKDF2-SHA256
const KEY_LENGTH = 256; // AES-256

// Derive an AES-GCM key from user UID + PIN using PBKDF2
export async function deriveEncryptionKey(uid: string, pin: string): Promise<CryptoKey> {
  const password = uid + ':' + pin;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a string — returns base64-encoded IV+ciphertext
export async function encryptData(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

// Decrypt a base64-encoded IV+ciphertext string
export async function decryptData(encrypted: string, key: CryptoKey): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Decryption failed — wrong key or corrupted data');
  }
}

// Encrypt the entire store state
export async function encryptStoreState(state: any, key: CryptoKey): Promise<string> {
  const json = JSON.stringify(state);
  return encryptData(json, key);
}

// Decrypt the entire store state
export async function decryptStoreState(encrypted: string, key: CryptoKey): Promise<any> {
  const json = await decryptData(encrypted, key);
  return JSON.parse(json);
}

// Store the encryption key in memory (NOT in localStorage)
let _memoryKey: CryptoKey | null = null;

export function setMemoryEncryptionKey(key: CryptoKey) {
  _memoryKey = key;
}

export function getMemoryEncryptionKey(): CryptoKey | null {
  return _memoryKey;
}

export function clearMemoryEncryptionKey() {
  _memoryKey = null;
}
