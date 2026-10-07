import { EncryptedPayload } from '../crypto/webcrypto';

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'gathering_ice'
  | 'awaiting_answer'
  | 'performing_handshake'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface ChatMessage {
  id: string;
  sender: 'local' | 'remote' | 'system';
  senderAlias?: string;
  text?: string;
  file?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string; // volatile object URL in RAM
    isImage?: boolean;
    data?: Uint8Array;
  };
  timestamp: number;
  encrypted: boolean;
  verified?: boolean;
}

export interface PeerHandshakeData {
  publicKeyBase64: string;
  alias: string;
  clientVersion: string;
}

export type WireMessage =
  | { type: 'HANDSHAKE_INIT'; data: PeerHandshakeData }
  | { type: 'HANDSHAKE_ACK'; data: PeerHandshakeData }
  | { type: 'RESTART_HANDSHAKE'; data: PeerHandshakeData }
  | { type: 'RESTART_HANDSHAKE_ACK'; data: PeerHandshakeData }
  | { type: 'ENCRYPTED_TEXT'; id: string; payload: EncryptedPayload; senderAlias: string }
  | {
      type: 'ENCRYPTED_FILE_CHUNK';
      fileId: string;
      chunkIndex: number;
      totalChunks: number;
      fileName: string;
      fileType: string;
      fileSize: number;
      payload: EncryptedPayload;
    }
  | { type: 'BURN_DISCONNECT' }
  | { type: 'TYPING'; isTyping: boolean }
  | { type: 'PING' }
  | { type: 'PONG' };
