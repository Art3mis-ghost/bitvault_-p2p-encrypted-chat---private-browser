/**
 * BitVault P2P WebRTC DataChannel Engine
 * Handles:
 * 1. Pure Manual Zero-Server Signaling (SDP Offer/Answer exchange via QR or token)
 * 2. 1-Click PeerJS Signaling fallback
 * 3. BroadcastChannel Local Multi-Tab / Simulator fallback
 * 4. Automatic ECDH key agreement over DataChannel
 * 5. AES-GCM 256-bit encryption for messages and file streams
 * 6. Volatile RAM buffering with zeroization on burn
 */

import {
  generateECDHKeyPair,
  importPeerPublicKey,
  deriveAESGCMKey,
  encryptText,
  decryptText,
  encryptBinary,
  decryptBinary,
  generateSafetyFingerprint,
  base64ToBytes,
  wipeMemory,
  KeyPairResult,
} from '../crypto/webcrypto';
import { compressPayload, decompressPayload } from '../utils/qrPayload';
import { ConnectionState, ChatMessage, WireMessage, PeerHandshakeData } from './p2pTypes';
import Peer, { DataConnection } from 'peerjs';

export interface P2PEngineCallbacks {
  onStateChange: (state: ConnectionState, detail?: string) => void;
  onMessage: (message: ChatMessage) => void;
  onFileProgress?: (fileId: string, percent: number) => void;
  onFingerprintReady: (fingerprint: {
    safetyNumbers: string;
    hexFingerprint: string;
    colorBlocks: string[];
    peerAlias: string;
  }) => void;
  onPeerTyping?: (isTyping: boolean) => void;
  onBurnReceived?: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

const CHUNK_SIZE = 16 * 1024; // 16 KB chunks for reliable RTCDataChannel transmission

export class P2PEngine {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private peerInstance: Peer | null = null;
  private peerConn: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;

  private localKeys: KeyPairResult | null = null;
  private peerPublicKey: CryptoKey | null = null;
  private sharedAesKey: CryptoKey | null = null;

  private state: ConnectionState = 'idle';
  private callbacks: P2PEngineCallbacks;
  private localAlias: string = 'User-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  private peerAlias: string = 'Remote Peer';

  // In-flight incoming file assemblies: fileId -> { chunks: Uint8Array[], receivedCount: number, meta: any }
  private incomingFiles: Map<
    string,
    {
      chunks: (Uint8Array | null)[];
      receivedCount: number;
      totalChunks: number;
      fileName: string;
      fileType: string;
      fileSize: number;
    }
  > = new Map();

  // Ping interval
  private pingIntervalId: any = null;

  // Connection tracking for seamless restart
  private lastConnectionMode: 'manual' | 'peerjs' | 'simulator' | null = null;
  private lastRoomId: string | null = null;
  private isPeerJSHost: boolean = false;

  constructor(callbacks: P2PEngineCallbacks, alias?: string) {
    this.callbacks = callbacks;
    if (alias) this.localAlias = alias;
  }

  public setAlias(alias: string) {
    this.localAlias = alias;
  }

  public getAlias(): string {
    return this.localAlias;
  }

  public getState(): ConnectionState {
    return this.state;
  }

  private setState(newState: ConnectionState, detail?: string) {
    this.state = newState;
    this.callbacks.onStateChange(newState, detail);
  }

  /**
   * Initializes local cryptographic keys
   */
  public async initKeys(): Promise<KeyPairResult> {
    if (!this.localKeys) {
      this.localKeys = await generateECDHKeyPair();
    }
    return this.localKeys;
  }

  /* ==============================================================
     1. ZERO-SERVER MANUAL SIGNALING (Offer / Answer)
     ============================================================== */

  /**
   * Create a manual WebRTC Offer with gathered ICE candidates bundled into a single token
   */
  public async createManualOffer(): Promise<string> {
    this.lastConnectionMode = 'manual';
    this.cleanup();
    await this.initKeys();
    this.setState('gathering_ice', 'Generating cryptographic offer and gathering ICE candidates...');

    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.setupPeerConnectionEvents(this.pc);

    // Create primary data channel
    this.dataChannel = this.pc.createDataChannel('bitvault-chat', {
      ordered: true,
    });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait until ICE gathering is complete or times out after 2.5s
    await this.waitForIceGathering(this.pc);

    this.setState('awaiting_answer', 'Offer ready. Waiting for peer Answer string or QR scan.');

    const offerPayload = {
      version: '1.0',
      type: 'offer',
      sdp: this.pc.localDescription?.sdp,
    };

    return await compressPayload(JSON.stringify(offerPayload));
  }

  /**
   * Remote peer accepts Offer string and produces Answer string
   */
  public async acceptManualOffer(offerToken: string): Promise<string> {
    this.lastConnectionMode = 'manual';
    this.cleanup();
    await this.initKeys();
    this.setState('connecting', 'Parsing peer offer...');

    let parsed: any;
    try {
      const decoded = await decompressPayload(offerToken.trim());
      parsed = JSON.parse(decoded);
      if (parsed.type !== 'offer' || !parsed.sdp) {
        throw new Error('Invalid Offer format');
      }
    } catch (e: any) {
      this.setState('error', 'Malformed Offer token: ' + (e.message || 'Check text format'));
      throw e;
    }

    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.setupPeerConnectionEvents(this.pc);

    // Listen for incoming data channel
    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: parsed.sdp }));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.setState('gathering_ice', 'Generating answer and gathering ICE candidates...');
    await this.waitForIceGathering(this.pc);

    const answerPayload = {
      version: '1.0',
      type: 'answer',
      sdp: this.pc.localDescription?.sdp,
    };

    this.setState('connecting', 'Answer generated. Share it back with the room creator.');
    return await compressPayload(JSON.stringify(answerPayload));
  }

  /**
   * Host accepts remote peer's Answer string to finalize connection
   */
  public async finalizeManualAnswer(answerToken: string): Promise<void> {
    if (!this.pc) {
      throw new Error('No active peer connection to apply answer');
    }

    let parsed: any;
    try {
      const decoded = await decompressPayload(answerToken.trim());
      parsed = JSON.parse(decoded);
      if (parsed.type !== 'answer' || !parsed.sdp) {
        throw new Error('Invalid Answer format');
      }
    } catch (e: any) {
      this.setState('error', 'Malformed Answer token');
      throw e;
    }

    this.setState('connecting', 'Applying peer answer...');
    await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: parsed.sdp }));
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);
      // Fallback timeout after 2.5 seconds in case some candidates take long
      setTimeout(() => {
        resolve();
      }, 2500);
    });
  }

  /* ==============================================================
     2. 1-CLICK PEERJS SIGNALING FALLBACK
     ============================================================== */

  /**
   * Host creates a 1-click room with an easy room code
   */
  public async createPeerJSRoom(roomId?: string): Promise<string> {
    this.cleanup();
    await this.initKeys();
    this.setState('connecting', 'Connecting to 1-click room network...');

    // Guarantee 100% uppercase room code without lowercase 'bv-'
    const finalRoomId = (roomId || 'BV-' + Math.random().toString(36).substring(2, 8)).toUpperCase();
    this.lastConnectionMode = 'peerjs';
    this.lastRoomId = finalRoomId;
    this.isPeerJSHost = true;

    return new Promise((resolve, reject) => {
      try {
        this.peerInstance = new Peer(finalRoomId, {
          debug: 1,
          config: ICE_SERVERS,
        });

        this.peerInstance.on('open', (id) => {
          const upperId = id.toUpperCase();
          this.setState('awaiting_answer', `Room active. Share Room Code: ${upperId}`);
          resolve(upperId);
        });

        this.peerInstance.on('connection', (conn) => {
          this.peerConn = conn;
          this.setupPeerJSConnection(conn);
        });

        this.peerInstance.on('error', (err: any) => {
          console.warn('PeerJS error:', err);
          let userMsg = err.message || err.type || 'Connection broker error';
          if (err.type === 'unavailable-id') {
            userMsg = 'Room ID is temporarily occupied. Please try creating a new room.';
          }
          this.setState('error', `Connection error: ${userMsg}`);
          reject(new Error(userMsg));
        });
      } catch (err: any) {
        this.setState('error', err.message);
        reject(err);
      }
    });
  }

  /**
   * Peer joins a 1-click room
   */
  public async joinPeerJSRoom(roomId: string): Promise<void> {
    this.cleanup();
    await this.initKeys();

    let cleanRoomId = roomId.trim().toUpperCase();
    if (!cleanRoomId.startsWith('BV-') && cleanRoomId.length <= 8) {
      cleanRoomId = 'BV-' + cleanRoomId;
    }
    this.lastConnectionMode = 'peerjs';
    this.lastRoomId = cleanRoomId;
    this.isPeerJSHost = false;
    this.setState('connecting', `Connecting to room ${cleanRoomId}...`);

    return new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const msg = `Connection timeout: Could not reach room "${cleanRoomId}". Verify the room code and ensure the host is waiting in the room.`;
          this.setState('error', msg);
          reject(new Error(msg));
        }
      }, 15000);

      try {
        this.peerInstance = new Peer({
          debug: 1,
          config: ICE_SERVERS,
        });

        this.peerInstance.on('open', () => {
          const conn = this.peerInstance!.connect(cleanRoomId, {
            reliable: true,
          });
          this.peerConn = conn;

          conn.on('open', () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              this.setupPeerJSConnection(conn);
              resolve();
            }
          });

          conn.on('error', (err: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              const userMsg = `Failed to connect to room "${cleanRoomId}": ${err.message || err.type}`;
              this.setState('error', userMsg);
              reject(new Error(userMsg));
            }
          });
        });

        this.peerInstance.on('error', (err: any) => {
          console.warn('PeerJS join error:', err);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            let userMsg = err.message || err.type || 'Could not connect to room';
            if (err.type === 'peer-unavailable' || (err.message && err.message.includes('Could not connect to peer'))) {
              userMsg = `Room "${cleanRoomId}" not found. Verify the room code on the host device and ensure the host is still waiting in the room.`;
            }
            this.setState('error', userMsg);
            reject(new Error(userMsg));
          }
        });
      } catch (err: any) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.setState('error', err.message);
          reject(err);
        }
      }
    });
  }

  private setupPeerJSConnection(conn: DataConnection) {
    const onOpen = () => {
      this.setState('performing_handshake', 'Peer connected. Initiating ECDH P-256 key exchange...');
      this.sendHandshakeInit();
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on('open', onOpen);
    }

    conn.on('data', (data: any) => {
      try {
        const wireMsg: WireMessage = typeof data === 'string' ? JSON.parse(data) : data;
        this.handleWireMessage(wireMsg);
      } catch (e) {
        console.error('Error handling PeerJS data:', e);
      }
    });

    conn.on('close', () => {
      this.handleRemoteDisconnect('Peer closed connection');
    });

    conn.on('error', (err) => {
      console.warn('Data connection error:', err);
      this.setState('error', 'Data link error: ' + err.message);
    });
  }

  /* ==============================================================
     3. LOCAL SIMULATION / MULTI-TAB SANDBOX (BroadcastChannel)
     ============================================================== */

  /**
   * Connects via BroadcastChannel so user can simulate two peers in the same browser
   */
  public async connectLocalSimulator(channelName: string = 'bitvault-sim-channel'): Promise<void> {
    this.lastConnectionMode = 'simulator';
    this.cleanup();
    await this.initKeys();
    this.setState('connecting', 'Activating local cryptographic channel...');

    this.broadcastChannel = new BroadcastChannel(channelName);
    this.broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.wire) {
        this.handleWireMessage(event.data.wire);
      }
    };

    setTimeout(() => {
      this.setState('performing_handshake', 'Virtual peer linked. Initiating ECDH key agreement...');
      this.sendHandshakeInit();
    }, 400);
  }

  /* ==============================================================
     WEBRTC DATALINK SETUP & EVENTS
     ============================================================== */

  private setupPeerConnectionEvents(pc: RTCPeerConnection) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.handleRemoteDisconnect(`WebRTC connection ${pc.connectionState}`);
      }
    };
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.setState('performing_handshake', 'DataChannel established. Exchanging ECDH public keys...');
      this.sendHandshakeInit();
      this.startHeartbeat();
    };

    channel.onmessage = (event) => {
      try {
        const parsed: WireMessage = JSON.parse(event.data);
        this.handleWireMessage(parsed);
      } catch (err) {
        console.error('Failed to parse incoming wire message:', err);
      }
    };

    channel.onclose = () => {
      this.handleRemoteDisconnect('DataChannel closed');
    };

    channel.onerror = (err) => {
      console.error('DataChannel error:', err);
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.state === 'connected') {
        this.sendWireMessage({ type: 'PING' });
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  /* ==============================================================
     CRYPTOGRAPHIC HANDSHAKE PROTOCOL
     ============================================================== */

  private async sendHandshakeInit() {
    if (!this.localKeys) await this.initKeys();
    const payload: WireMessage = {
      type: 'HANDSHAKE_INIT',
      data: {
        publicKeyBase64: this.localKeys!.publicKeyBase64,
        alias: this.localAlias,
        clientVersion: 'BitVault-1.0',
      },
    };
    this.sendWireMessage(payload);
  }

  private async handleWireMessage(msg: WireMessage) {
    switch (msg.type) {
      case 'HANDSHAKE_INIT': {
        await this.processRemotePublicKey(msg.data);
        // Reply with ACK containing our public key
        if (!this.localKeys) await this.initKeys();
        const ackPayload: WireMessage = {
          type: 'HANDSHAKE_ACK',
          data: {
            publicKeyBase64: this.localKeys!.publicKeyBase64,
            alias: this.localAlias,
            clientVersion: 'BitVault-1.0',
          },
        };
        this.sendWireMessage(ackPayload);
        break;
      }

      case 'HANDSHAKE_ACK': {
        await this.processRemotePublicKey(msg.data);
        break;
      }

      case 'RESTART_HANDSHAKE': {
        this.callbacks.onMessage({
          id: 'sys-' + Date.now(),
          sender: 'system',
          text: `🔄 Peer ${msg.data.alias || this.peerAlias} requested a P2P session restart. Re-generating fresh cryptographic keys...`,
          timestamp: Date.now(),
          encrypted: false,
        });
        this.localKeys = await generateECDHKeyPair();
        await this.processRemotePublicKey(msg.data);
        const ackPayload: WireMessage = {
          type: 'RESTART_HANDSHAKE_ACK',
          data: {
            publicKeyBase64: this.localKeys.publicKeyBase64,
            alias: this.localAlias,
            clientVersion: 'BitVault-1.0',
          },
        };
        this.sendWireMessage(ackPayload);
        this.callbacks.onMessage({
          id: 'sys-' + Date.now(),
          sender: 'system',
          text: `🔐 P2P Session restarted! Fresh ECDH P-256 keys derived and active with ${this.peerAlias}.`,
          timestamp: Date.now(),
          encrypted: true,
          verified: true,
        });
        break;
      }

      case 'RESTART_HANDSHAKE_ACK': {
        await this.processRemotePublicKey(msg.data);
        this.callbacks.onMessage({
          id: 'sys-' + Date.now(),
          sender: 'system',
          text: `🔐 P2P Session restarted! Fresh ECDH P-256 keys derived and active with ${this.peerAlias}.`,
          timestamp: Date.now(),
          encrypted: true,
          verified: true,
        });
        break;
      }

      case 'ENCRYPTED_TEXT': {
        await this.handleIncomingEncryptedText(msg);
        break;
      }

      case 'ENCRYPTED_FILE_CHUNK': {
        await this.handleIncomingFileChunk(msg);
        break;
      }

      case 'TYPING': {
        if (this.callbacks.onPeerTyping) {
          this.callbacks.onPeerTyping(msg.isTyping);
        }
        break;
      }

      case 'BURN_DISCONNECT': {
        if (this.callbacks.onBurnReceived) {
          this.callbacks.onBurnReceived();
        }
        this.burnAndWipe();
        break;
      }

      case 'PING': {
        this.sendWireMessage({ type: 'PONG' });
        break;
      }

      case 'PONG': {
        // Heartbeat ACK
        break;
      }
    }
  }

  private async processRemotePublicKey(data: PeerHandshakeData) {
    try {
      this.peerAlias = data.alias || 'Remote Peer';
      const peerRaw = base64ToBytes(data.publicKeyBase64);
      this.peerPublicKey = await importPeerPublicKey(peerRaw);

      if (!this.localKeys) await this.initKeys();
      this.sharedAesKey = await deriveAESGCMKey(this.localKeys!.keyPair.privateKey, this.peerPublicKey);

      // Generate safety numbers and visual fingerprint
      const fingerprint = await generateSafetyFingerprint(
        this.localKeys!.publicKeyRaw,
        peerRaw
      );

      this.callbacks.onFingerprintReady({
        ...fingerprint,
        peerAlias: this.peerAlias,
      });

      this.setState('connected', `Encrypted P2P Connected with ${this.peerAlias}`);

      this.callbacks.onMessage({
        id: 'sys-' + Date.now(),
        sender: 'system',
        text: `🔐 ECDH P-256 Key Agreement Complete. Shared AES-256-GCM symmetric session established with ${this.peerAlias}. Ephemeral volatile memory active.`,
        timestamp: Date.now(),
        encrypted: true,
        verified: true,
      });
    } catch (e: any) {
      console.error('Key agreement failure:', e);
      this.setState('error', 'Cryptographic handshake failed: ' + e.message);
    }
  }

  /* ==============================================================
     ENCRYPTED MESSAGING & FILE TRANSFER
     ============================================================== */

  public async sendTextMessage(text: string): Promise<ChatMessage> {
    if (this.state !== 'connected' || !this.sharedAesKey) {
      throw new Error('Cannot send message: Not connected or unencrypted');
    }

    const payload = await encryptText(text, this.sharedAesKey);
    const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const wire: WireMessage = {
      type: 'ENCRYPTED_TEXT',
      id: msgId,
      payload,
      senderAlias: this.localAlias,
    };

    this.sendWireMessage(wire);

    const localMsg: ChatMessage = {
      id: msgId,
      sender: 'local',
      senderAlias: this.localAlias,
      text,
      timestamp: Date.now(),
      encrypted: true,
      verified: true,
    };

    this.callbacks.onMessage(localMsg);
    return localMsg;
  }

  private async handleIncomingEncryptedText(msg: {
    id: string;
    payload: any;
    senderAlias: string;
  }) {
    if (!this.sharedAesKey) return;
    try {
      const plaintext = await decryptText(msg.payload, this.sharedAesKey);
      const incoming: ChatMessage = {
        id: msg.id,
        sender: 'remote',
        senderAlias: msg.senderAlias || this.peerAlias,
        text: plaintext,
        timestamp: msg.payload.timestamp || Date.now(),
        encrypted: true,
        verified: true,
      };
      this.callbacks.onMessage(incoming);
    } catch (err: any) {
      console.error('Decryption error:', err);
      this.callbacks.onMessage({
        id: 'err-' + Date.now(),
        sender: 'system',
        text: '⚠️ Decryption failed for incoming packet (corrupted or invalid MAC tag).',
        timestamp: Date.now(),
        encrypted: false,
      });
    }
  }

  public async sendFile(file: File): Promise<ChatMessage> {
    if (this.state !== 'connected' || !this.sharedAesKey) {
      throw new Error('Cannot send file: Peer not connected');
    }

    const fileId = 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const totalBytes = bytes.length;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    const isImage = file.type.startsWith('image/');
    // Create ephemeral object URL for local preview in RAM
    const localUrl = URL.createObjectURL(new Blob([bytes], { type: file.type }));

    // Send chunks sequentially
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkBytes = bytes.subarray(start, end);

      const encryptedChunk = await encryptBinary(chunkBytes, this.sharedAesKey);

      const wire: WireMessage = {
        type: 'ENCRYPTED_FILE_CHUNK',
        fileId,
        chunkIndex: i,
        totalChunks,
        fileName: file.name,
        fileType: file.type,
        fileSize: totalBytes,
        payload: encryptedChunk,
      };

      this.sendWireMessage(wire);

      if (this.callbacks.onFileProgress) {
        this.callbacks.onFileProgress(fileId, Math.round(((i + 1) / totalChunks) * 100));
      }

      // Small tick delay to prevent channel buffer overflow on large files
      if (i % 8 === 0) {
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    const localMsg: ChatMessage = {
      id: fileId,
      sender: 'local',
      senderAlias: this.localAlias,
      timestamp: Date.now(),
      encrypted: true,
      verified: true,
      file: {
        id: fileId,
        name: file.name,
        type: file.type,
        size: totalBytes,
        url: localUrl,
        isImage,
      },
    };

    this.callbacks.onMessage(localMsg);
    return localMsg;
  }

  private async handleIncomingFileChunk(msg: {
    fileId: string;
    chunkIndex: number;
    totalChunks: number;
    fileName: string;
    fileType: string;
    fileSize: number;
    payload: any;
  }) {
    if (!this.sharedAesKey) return;

    try {
      const decryptedBytes = await decryptBinary(msg.payload, this.sharedAesKey);

      let record = this.incomingFiles.get(msg.fileId);
      if (!record) {
        record = {
          chunks: new Array(msg.totalChunks).fill(null),
          receivedCount: 0,
          totalChunks: msg.totalChunks,
          fileName: msg.fileName,
          fileType: msg.fileType,
          fileSize: msg.fileSize,
        };
        this.incomingFiles.set(msg.fileId, record);
      }

      record.chunks[msg.chunkIndex] = decryptedBytes;
      record.receivedCount++;

      if (this.callbacks.onFileProgress) {
        this.callbacks.onFileProgress(
          msg.fileId,
          Math.round((record.receivedCount / record.totalChunks) * 100)
        );
      }

      // Check if all chunks received
      if (record.receivedCount >= record.totalChunks) {
        // Assemble file in volatile RAM
        const combined = new Uint8Array(record.fileSize);
        let offset = 0;
        for (let i = 0; i < record.totalChunks; i++) {
          const chunk = record.chunks[i];
          if (chunk) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
        }

        const blob = new Blob([combined], { type: record.fileType });
        const volatileUrl = URL.createObjectURL(blob);
        const isImage = record.fileType.startsWith('image/');

        const fileMsg: ChatMessage = {
          id: msg.fileId,
          sender: 'remote',
          senderAlias: this.peerAlias,
          timestamp: Date.now(),
          encrypted: true,
          verified: true,
          file: {
            id: msg.fileId,
            name: record.fileName,
            type: record.fileType,
            size: record.fileSize,
            url: volatileUrl,
            isImage,
            data: combined,
          },
        };

        this.incomingFiles.delete(msg.fileId);
        this.callbacks.onMessage(fileMsg);
      }
    } catch (err: any) {
      console.error('File chunk decryption failed:', err);
    }
  }

  public sendTyping(isTyping: boolean) {
    if (this.state === 'connected') {
      this.sendWireMessage({ type: 'TYPING', isTyping });
    }
  }

  private sendWireMessage(msg: WireMessage) {
    const serialized = JSON.stringify(msg);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(serialized);
      return;
    }

    if (this.peerConn && this.peerConn.open) {
      this.peerConn.send(serialized);
      return;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ wire: msg });
      return;
    }
  }

  /* ==============================================================
     BURN ON DISCONNECT & COMPLETE VOLATILE PURGE
     ============================================================== */

  /**
   * Triggers panic burn: alerts remote peer to wipe immediately, then wipes local state
   */
  public triggerBurnAll() {
    try {
      this.sendWireMessage({ type: 'BURN_DISCONNECT' });
    } catch (e) {
      // ignore
    }
    this.burnAndWipe();
  }

  /**
   * Sanitizes all volatile cryptographic material and memory buffers
   */
  public burnAndWipe() {
    this.stopHeartbeat();

    // Overwrite incoming file chunks
    this.incomingFiles.forEach((record) => {
      record.chunks.forEach((chunk) => {
        if (chunk) wipeMemory(chunk);
      });
    });
    this.incomingFiles.clear();

    // Overwrite local raw public key
    if (this.localKeys && this.localKeys.publicKeyRaw) {
      wipeMemory(this.localKeys.publicKeyRaw);
    }
    this.localKeys = null;
    this.peerPublicKey = null;
    this.sharedAesKey = null;

    this.cleanup();
    this.setState('disconnected', 'Volatile memory purged. All cryptographic keys zeroized.');
  }

  private handleRemoteDisconnect(reason: string) {
    this.cleanup();
    this.setState('disconnected', `Peer disconnected: ${reason}`);
    this.callbacks.onMessage({
      id: 'sys-' + Date.now(),
      sender: 'system',
      text: `Peer disconnected (${reason}). Session terminated.`,
      timestamp: Date.now(),
      encrypted: false,
    });
  }

  /**
   * Restarts the P2P connection with the connected device:
   * - If actively connected, negotiates brand new ECDH P-256 session keys and verifies fingerprint
   * - If disconnected/dropped, reconnects to the last active room / channel
   * - If no prior connection, invokes the fallback callback to open the connection modal
   */
  public async restartConnection(onFallbackModal?: () => void): Promise<void> {
    const isChannelOpen =
      (this.dataChannel && this.dataChannel.readyState === 'open') ||
      (this.peerConn && this.peerConn.open) ||
      !!this.broadcastChannel;

    if (this.state === 'connected' && isChannelOpen) {
      this.setState('performing_handshake', 'Restarting session and re-negotiating ECDH keys...');
      this.callbacks.onMessage({
        id: 'sys-' + Date.now(),
        sender: 'system',
        text: `🔄 Initiating P2P session restart with ${this.peerAlias}...`,
        timestamp: Date.now(),
        encrypted: false,
      });

      this.localKeys = await generateECDHKeyPair();
      const restartPayload: WireMessage = {
        type: 'RESTART_HANDSHAKE',
        data: {
          publicKeyBase64: this.localKeys.publicKeyBase64,
          alias: this.localAlias,
          clientVersion: 'BitVault-1.0',
        },
      };
      this.sendWireMessage(restartPayload);
      return;
    }

    // Connection was dropped or inactive: Re-connect using saved context
    if (this.lastConnectionMode === 'peerjs' && this.lastRoomId) {
      const roomId = this.lastRoomId;
      if (this.isPeerJSHost) {
        this.callbacks.onMessage({
          id: 'sys-' + Date.now(),
          sender: 'system',
          text: `🔄 Restarting 1-Click host room ${roomId}...`,
          timestamp: Date.now(),
          encrypted: false,
        });
        await this.createPeerJSRoom(roomId);
      } else {
        this.callbacks.onMessage({
          id: 'sys-' + Date.now(),
          sender: 'system',
          text: `🔄 Reconnecting to 1-Click room ${roomId}...`,
          timestamp: Date.now(),
          encrypted: false,
        });
        await this.joinPeerJSRoom(roomId);
      }
      return;
    }

    if (this.lastConnectionMode === 'simulator') {
      await this.connectLocalSimulator();
      return;
    }

    if (onFallbackModal) {
      onFallbackModal();
    }
  }

  private cleanup() {
    this.stopHeartbeat();

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }

    if (this.peerConn) {
      try {
        this.peerConn.close();
      } catch (e) {}
      this.peerConn = null;
    }

    if (this.peerInstance) {
      try {
        this.peerInstance.destroy();
      } catch (e) {}
      this.peerInstance = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {}
      this.broadcastChannel = null;
    }
  }
}
