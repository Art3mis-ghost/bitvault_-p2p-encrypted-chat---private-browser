/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SecurityHeader } from './components/SecurityHeader';
import { ChatPanel } from './components/ChatPanel';
import { BrowserPanel } from './components/BrowserPanel';
import { ConnectionModal } from './components/ConnectionModal';
import { FingerprintModal } from './components/FingerprintModal';
import { P2PEngine, P2PEngineCallbacks } from './webrtc/p2pEngine';
import { ChatMessage, ConnectionState } from './webrtc/p2pTypes';
import { MessageSquare, Globe, Shield, Radio, KeyRound, AlertTriangle } from 'lucide-react';
import { playCipherKeySound, playMessageReceivedSound, playBurnSound } from './utils/audioFeedback';
import { extractUrlTokens } from './utils/qrPayload';

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fingerprint, setFingerprint] = useState<{
    safetyNumbers: string;
    hexFingerprint: string;
    colorBlocks: string[];
    peerAlias: string;
  } | null>(null);

  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [initialOfferToken, setInitialOfferToken] = useState<string | undefined>(undefined);
  const [isFingerprintModalOpen, setIsFingerprintModalOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'split' | 'chat' | 'browser'>('split');
  const [mobileTab, setMobileTab] = useState<'chat' | 'browser'>('chat');
  const [fileProgress, setFileProgress] = useState<{ [fileId: string]: number }>({});
  const [isPeerTyping, setIsPeerTyping] = useState(false);

  const [localAlias, setLocalAlias] = useState(() => 'User-' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const [peerAlias, setPeerAlias] = useState('Remote Peer');

  const callbacksRef = useRef<P2PEngineCallbacks>({
    onStateChange: () => {},
    onMessage: () => {},
    onFingerprintReady: () => {},
  });

  callbacksRef.current = {
    onStateChange: (state, detail) => {
      setConnectionState(state);
      if (state === 'connected') {
        playCipherKeySound();
      }
    },
    onMessage: (message) => {
      if (message.sender === 'remote') {
        playMessageReceivedSound();
      }
      setMessages((prev) => [...prev, message]);
    },
    onFileProgress: (fileId, percent) => {
      setFileProgress((prev) => {
        if (percent >= 100) {
          const copy = { ...prev };
          delete copy[fileId];
          return copy;
        }
        return { ...prev, [fileId]: percent };
      });
    },
    onFingerprintReady: (fp) => {
      setFingerprint(fp);
      setPeerAlias(fp.peerAlias);
    },
    onPeerTyping: (typing) => {
      setIsPeerTyping(typing);
    },
    onBurnReceived: () => {
      playBurnSound();
      setMessages([]);
      setFingerprint(null);
    },
  };

  const [p2pEngine] = useState(() => {
    return new P2PEngine(
      {
        onStateChange: (state, detail) => callbacksRef.current.onStateChange(state, detail),
        onMessage: (message) => callbacksRef.current.onMessage(message),
        onFileProgress: (fileId, percent) => callbacksRef.current.onFileProgress?.(fileId, percent),
        onFingerprintReady: (fp) => callbacksRef.current.onFingerprintReady(fp),
        onPeerTyping: (typing) => callbacksRef.current.onPeerTyping?.(typing),
        onBurnReceived: () => callbacksRef.current.onBurnReceived?.(),
      },
      localAlias
    );
  });

  const p2pEngineRef = useRef<P2PEngine>(p2pEngine);
  p2pEngineRef.current = p2pEngine;

  useEffect(() => {
    // Check URL tokens for room code or direct scanned offer payload
    const tokens = extractUrlTokens();
    if (tokens.offer) {
      setInitialOfferToken(tokens.offer);
      setIsConnectionModalOpen(true);
    } else if (tokens.room) {
      setIsConnectionModalOpen(true);
    }

    return () => {
      p2pEngine.burnAndWipe();
    };
  }, [p2pEngine]);

  const handleBurnAll = () => {
    p2pEngine.triggerBurnAll();
    setMessages([]);
    setFingerprint(null);
    setFileProgress({});
    setConnectionState('disconnected');
  };

  const handleUpdateAlias = (newAlias: string) => {
    setLocalAlias(newAlias);
    p2pEngine.setAlias(newAlias);
  };

  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartConnection = async () => {
    setIsRestarting(true);
    try {
      await p2pEngine.restartConnection(() => {
        setIsConnectionModalOpen(true);
      });
    } catch (err: any) {
      console.warn('Failed to restart connection:', err);
    } finally {
      setTimeout(() => setIsRestarting(false), 800);
    }
  };

  const isSecure = typeof window !== 'undefined'
    ? (window.isSecureContext ?? (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    : true;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d15] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Insecure Origin Alert */}
      {!isSecure && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 z-50 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Insecure HTTP Context:</strong> Mobile & remote browsers disable WebCrypto encryption keys on HTTP.
              Please switch to HTTPS:
            </span>
          </div>
          <a
            href={typeof window !== 'undefined' ? window.location.href.replace('http://', 'https://') : '#'}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-xs transition-colors shrink-0 shadow-sm"
          >
            Switch to HTTPS ({typeof window !== 'undefined' ? window.location.host : ''})
          </a>
        </div>
      )}

      {/* Top Bar */}
      <SecurityHeader
        connectionState={connectionState}
        onOpenConnectModal={() => setIsConnectionModalOpen(true)}
        onOpenFingerprint={() => setIsFingerprintModalOpen(true)}
        onBurnAll={handleBurnAll}
        onRestartConnection={handleRestartConnection}
        isRestarting={isRestarting}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        peerAlias={peerAlias}
        hasFingerprint={!!fingerprint}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Desktop View / Responsive Container */}
        <div className="hidden lg:flex w-full h-full overflow-hidden">
          {/* Chat Column */}
          {(layoutMode === 'split' || layoutMode === 'chat') && (
            <div
              className={`h-full transition-all duration-200 ${
                layoutMode === 'chat' ? 'w-full' : 'w-1/2'
              }`}
            >
              <ChatPanel
                messages={messages}
                connectionState={connectionState}
                p2pEngine={p2pEngine}
                onOpenConnectModal={() => setIsConnectionModalOpen(true)}
                onOpenFingerprint={() => setIsFingerprintModalOpen(true)}
                onBurnAll={handleBurnAll}
                peerAlias={peerAlias}
                localAlias={localAlias}
                onUpdateAlias={handleUpdateAlias}
                fileProgress={fileProgress}
                isPeerTyping={isPeerTyping}
              />
            </div>
          )}

          {/* Browser Column */}
          {(layoutMode === 'split' || layoutMode === 'browser') && (
            <div
              className={`h-full transition-all duration-200 ${
                layoutMode === 'browser' ? 'w-full' : 'w-1/2'
              }`}
            >
              <BrowserPanel />
            </div>
          )}
        </div>

        {/* Tablet / Mobile View (Tabbed) */}
        <div className="flex lg:hidden flex-1 w-full h-full overflow-hidden">
          {mobileTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              connectionState={connectionState}
              p2pEngine={p2pEngine}
              onOpenConnectModal={() => setIsConnectionModalOpen(true)}
              onOpenFingerprint={() => setIsFingerprintModalOpen(true)}
              onBurnAll={handleBurnAll}
              peerAlias={peerAlias}
              localAlias={localAlias}
              onUpdateAlias={handleUpdateAlias}
              fileProgress={fileProgress}
              isPeerTyping={isPeerTyping}
            />
          ) : (
            <BrowserPanel />
          )}
        </div>
      </main>

      {/* Mobile Bottom Tab Navigation */}
      <div className="flex lg:hidden h-12 bg-[#0c121d] border-t border-slate-800 items-center justify-around px-4 shrink-0 z-20">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
            mobileTab === 'chat'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Encrypted Chat</span>
        </button>

        <button
          onClick={() => setMobileTab('browser')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
            mobileTab === 'browser'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Private Browser</span>
        </button>
      </div>

      {/* Modals */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => {
          setIsConnectionModalOpen(false);
          setInitialOfferToken(undefined);
        }}
        p2pEngine={p2pEngine}
        initialOffer={initialOfferToken}
      />

      <FingerprintModal
        isOpen={isFingerprintModalOpen}
        onClose={() => setIsFingerprintModalOpen(false)}
        fingerprint={fingerprint}
        localAlias={localAlias}
      />
    </div>
  );
}
