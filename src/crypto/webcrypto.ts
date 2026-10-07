/**
 * Web Crypto API primitives for BitVault
 * - ECDH P-256 Curve Key Agreement
 * - AES-GCM 256-bit dynamic-IV symmetric encryption
 * - SHA-256 safety numbers & visual fingerprint checksum
 * - In-memory ephemeral zeroization
 */

export interface KeyPairResult {
  keyPair: CryptoKeyPair;
  publicKeyBase64: string;
  publicKeyRaw: Uint8Array;
}

export interface EncryptedPayload {
  iv: string; // base64 12 bytes
  ciphertext: string; // base64
  tag?: string;
  timestamp: number;
}

// Convert Uint8Array to base64
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to Uint8Array
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Check if SubtleCrypto is available in the current environment
export function isSubtleCryptoSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.crypto && window.crypto.subtle);
}

// Safely obtain SubtleCrypto or throw an actionable error
export function getSubtleCrypto(): SubtleCrypto {
  if (isSubtleCryptoSupported()) {
    return window.crypto.subtle;
  }
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isHttps && !isLocal && typeof window !== 'undefined') {
    throw new Error(
      `Web Cryptography API (crypto.subtle) is blocked on insecure HTTP origins. Please open the secure HTTPS URL: https://${window.location.host}${window.location.pathname}`
    );
  }
  throw new Error('Web Cryptography API (crypto.subtle) is not supported in this browser environment.');
}

// Generate ECDH P-256 key pair
export async function generateECDHKeyPair(): Promise<KeyPairResult> {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const rawBuffer = await subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyRaw = new Uint8Array(rawBuffer);
  const publicKeyBase64 = bytesToBase64(publicKeyRaw);

  return { keyPair, publicKeyBase64, publicKeyRaw };
}

// Import remote peer's public key from raw bytes
export async function importPeerPublicKey(publicKeyRaw: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return await subtle.importKey(
    'raw',
    publicKeyRaw as unknown as BufferSource,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

// Derive AES-GCM 256-bit symmetric key from local private key and remote public key
export async function deriveAESGCMKey(
  localPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return await subtle.deriveKey(
    {
      name: 'ECDH',
      public: remotePublicKey,
    },
    localPrivateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // non-extractable for memory defense
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext string using AES-GCM 256-bit with fresh dynamic 12-byte IV
export async function encryptText(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const subtle = getSubtleCrypto();
  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    data as unknown as BufferSource
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    timestamp: Date.now(),
  };
}

// Decrypt ciphertext using AES-GCM 256-bit
export async function decryptText(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const subtle = getSubtleCrypto();
  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Encrypt raw binary buffer (e.g. file attachment)
export async function encryptBinary(
  data: Uint8Array,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const subtle = getSubtleCrypto();
  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    data as unknown as BufferSource
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    timestamp: Date.now(),
  };
}

// Decrypt raw binary buffer
export async function decryptBinary(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<Uint8Array> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);

  const subtle = getSubtleCrypto();
  const decryptedBuffer = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  return new Uint8Array(decryptedBuffer);
}

/**
 * Generate Safety Fingerprint / Verification Code
 * Combines both public keys in a deterministic order and computes SHA-256.
 * Outputs:
 * - 6 blocks of 5 digits (Signal-style safety numbers: e.g., 42819 09182 44910 ...)
 * - Hexadecimal fingerprint (64 chars)
 * - 8 visual hex color blocks for immediate ocular verification
 */
export async function generateSafetyFingerprint(
  localPubRaw: Uint8Array,
  peerPubRaw: Uint8Array
): Promise<{
  safetyNumbers: string;
  hexFingerprint: string;
  colorBlocks: string[];
}> {
  // Sort keys lexicographically so both peers produce identical fingerprints regardless of who initiated
  const compare = compareUint8Arrays(localPubRaw, peerPubRaw);
  const combined = new Uint8Array(localPubRaw.length + peerPubRaw.length);
  if (compare <= 0) {
    combined.set(localPubRaw, 0);
    combined.set(peerPubRaw, localPubRaw.length);
  } else {
    combined.set(peerPubRaw, 0);
    combined.set(localPubRaw, peerPubRaw.length);
  }

  const subtle = getSubtleCrypto();
  const hashBuffer = await subtle.digest('SHA-256', combined as unknown as BufferSource);
  const hashBytes = new Uint8Array(hashBuffer);

  // Hexadecimal fingerprint
  const hexParts: string[] = [];
  for (let i = 0; i < hashBytes.length; i++) {
    hexParts.push(hashBytes[i].toString(16).padStart(2, '0'));
  }
  const hexFingerprint = hexParts.join('').toUpperCase();

  // 6 numeric blocks of 5 digits
  // Convert 4-byte chunks to numbers modulo 100,000
  const blocks: string[] = [];
  const view = new DataView(hashBuffer);
  for (let i = 0; i < 6; i++) {
    const val = view.getUint32(i * 4, false);
    const num = (val % 100000).toString().padStart(5, '0');
    blocks.push(num);
  }
  const safetyNumbers = blocks.join(' ');

  // 8 visual color blocks for quick glance verification
  const colorBlocks: string[] = [];
  for (let i = 0; i < 8; i++) {
    const r = hashBytes[i * 3];
    const g = hashBytes[i * 3 + 1];
    const b = hashBytes[i * 3 + 2];
    colorBlocks.push(`rgb(${r}, ${g}, ${b})`);
  }

  return { safetyNumbers, hexFingerprint, colorBlocks };
}

function compareUint8Arrays(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

// Memory sanitization helper: overwrites typed arrays with zero
export function wipeMemory(buffer: Uint8Array | null | undefined): void {
  if (buffer && buffer.fill) {
    buffer.fill(0);
  }
}
