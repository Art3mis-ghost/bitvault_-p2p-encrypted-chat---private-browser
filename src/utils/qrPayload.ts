/**
 * Utilities for high-density WebRTC SDP compression and QR code payload generation.
 * Compresses SDP strings by 60-70% using gzip/deflate CompressionStream so QR codes
 * remain readable by mobile cameras from distance in varied lighting conditions.
 */

import { bytesToBase64, base64ToBytes } from '../crypto/webcrypto';

// Compress string with native gzip stream
export async function compressPayload(text: string): Promise<string> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
      const buffer = await new Response(stream).arrayBuffer();
      // Prefix with 'z:' to denote gzip compression
      return 'z:' + bytesToBase64(new Uint8Array(buffer));
    } catch (e) {
      console.warn('Compression failed, falling back to base64:', e);
    }
  }
  return 'r:' + btoa(unescape(encodeURIComponent(text)));
}

// Decompress string
export async function decompressPayload(payload: string): Promise<string> {
  const trimmed = payload.trim();

  // If payload is a full URL, extract hash or query parameter
  let cleanPayload = trimmed;
  if (cleanPayload.includes('#offer=')) {
    cleanPayload = cleanPayload.split('#offer=')[1].split('&')[0];
  } else if (cleanPayload.includes('?offer=')) {
    cleanPayload = cleanPayload.split('?offer=')[1].split('&')[0];
  } else if (cleanPayload.includes('#answer=')) {
    cleanPayload = cleanPayload.split('#answer=')[1].split('&')[0];
  } else if (cleanPayload.includes('?answer=')) {
    cleanPayload = cleanPayload.split('?answer=')[1].split('&')[0];
  }

  // Check prefix
  if (cleanPayload.startsWith('z:')) {
    const rawBase64 = cleanPayload.slice(2);
    const bytes = base64ToBytes(rawBase64);
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes as unknown as BufferSource]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
  }

  if (cleanPayload.startsWith('r:')) {
    const rawBase64 = cleanPayload.slice(2);
    return decodeURIComponent(escape(atob(rawBase64)));
  }

  // Legacy fallback: plain base64 json
  try {
    return atob(cleanPayload);
  } catch {
    return cleanPayload;
  }
}

/**
 * Creates a mobile-friendly Join URL embedding the compressed offer token
 */
export function buildOfferJoinUrl(compressedOffer: string): string {
  let origin = window.location.origin;
  // Ensure the remote join URL uses HTTPS so the peer's browser runs in a secure context with WebCrypto enabled
  if (origin.startsWith('http://')) {
    origin = origin.replace('http://', 'https://');
  }
  const base = origin + window.location.pathname;
  return `${base}#offer=${encodeURIComponent(compressedOffer)}`;
}

/**
 * Extracts offer or answer token from current window URL hash or query params
 */
export function extractUrlTokens(): { offer?: string; answer?: string; room?: string } {
  const result: { offer?: string; answer?: string; room?: string } = {};

  // Check hash
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    if (params.get('offer')) result.offer = params.get('offer')!;
    if (params.get('answer')) result.answer = params.get('answer')!;
  }

  // Check search query
  if (window.location.search) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('offer')) result.offer = params.get('offer')!;
    if (params.get('answer')) result.answer = params.get('answer')!;
    if (params.get('room')) result.room = params.get('room')!;
  }

  return result;
}
