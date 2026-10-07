import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Flame,
  Radio,
  RotateCw,
  Columns,
  MessageSquare,
  Globe,
  Lock,
  KeyRound,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import { ConnectionState } from '../webrtc/p2pTypes';

interface SecurityHeaderProps {
  connectionState: ConnectionState;
  onOpenConnectModal: () => void;
  onOpenFingerprint: () => void;
  onBurnAll: () => void;
  onRestartConnection: () => void;
  isRestarting?: boolean;
  layoutMode: 'split' | 'chat' | 'browser';
  setLayoutMode: (mode: 'split' | 'chat' | 'browser') => void;
  peerAlias: string;
  hasFingerprint: boolean;
}

export const SecurityHeader: React.FC<SecurityHeaderProps> = ({
  connectionState,
  onOpenConnectModal,
  onOpenFingerprint,
  onBurnAll,
  onRestartConnection,
  isRestarting = false,
  layoutMode,
  setLayoutMode,
  peerAlias,
  hasFingerprint,
}) => {
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return {
          color: 'bg-emerald-500 shadow-emerald-500/50 shadow-sm',
          text: 'Encrypted P2P Connected',
          badgeClass: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
          icon: ShieldCheck,
        };
      case 'performing_handshake':
        return {
          color: 'bg-cyan-400 animate-pulse',
          text: 'Performing Key Exchange (ECDH P-256)',
          badgeClass: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
          icon: KeyRound,
        };
      case 'gathering_ice':
      case 'awaiting_answer':
        return {
          color: 'bg-amber-400 animate-pulse',
          text: 'Awaiting Peer Connection',
          badgeClass: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
          icon: Radio,
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Connection Error',
          badgeClass: 'bg-red-950/80 border-red-500/40 text-red-300',
          icon: AlertOctagon,
        };
      default:
        return {
          color: 'bg-slate-500',
          text: 'Disconnected (Zero-Server)',
          badgeClass: 'bg-slate-900 border-slate-700/80 text-slate-400',
          icon: Shield,
        };
    }
  };

  const status = getStatusBadge();
  const StatusIcon = status.icon;

  return (
    <header className="h-14 px-4 bg-[#0a0e16] border-b border-slate-800 flex items-center justify-between shrink-0 select-none z-30">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-950/50">
            <Shield className="w-4 h-4 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white tracking-wider">BitVault</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                P2P
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Zero-Server E2EE · Sandboxed Vault
            </div>
          </div>
        </div>

        {/* Connection Status Pill / Indicator */}
        <div
          onClick={connectionState !== 'connected' ? onOpenConnectModal : onOpenFingerprint}
          className={`cursor-pointer px-2.5 py-1 rounded-full border text-xs font-mono flex items-center gap-2 transition-all hover:opacity-90 ${status.badgeClass}`}
          title="Click to view connection options or safety fingerprint"
        >
          <span className={`w-2 h-2 rounded-full ${status.color}`} />
          <span className="hidden md:inline font-medium">{status.text}</span>
          <StatusIcon className="w-3.5 h-3.5 opacity-80" />
        </div>
      </div>

      {/* Center Layout Switcher (Segmented Control) */}
      <div className="hidden lg:flex items-center p-1 bg-slate-950/90 rounded-lg border border-slate-800 text-xs font-medium">
        <button
          onClick={() => setLayoutMode('chat')}
          className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
            layoutMode === 'chat'
              ? 'bg-slate-800 text-emerald-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="View Encrypted Chat Only"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat Only</span>
        </button>

        <button
          onClick={() => setLayoutMode('split')}
          className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
            layoutMode === 'split'
              ? 'bg-slate-800 text-cyan-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Split View (Chat + Private Browser)"
        >
          <Columns className="w-3.5 h-3.5" />
          <span>Split Screen</span>
        </button>

        <button
          onClick={() => setLayoutMode('browser')}
          className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
            layoutMode === 'browser'
              ? 'bg-slate-800 text-purple-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="View Private Browser Only"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Private Browser</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Safety Numbers shortcut */}
        {hasFingerprint && (
          <button
            onClick={onOpenFingerprint}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono transition-colors"
            title="Inspect SHA-256 Safety Numbers"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Safety Numbers</span>
          </button>
        )}

        {/* Restart P2P Connection */}
        <button
          onClick={onRestartConnection}
          disabled={isRestarting}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            connectionState === 'connected'
              ? 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/40 text-cyan-300 hover:text-white shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
          }`}
          title="Restart P2P Connection: Re-negotiate secure channel and fresh ECDH keys with the connected peer"
        >
          <RotateCw className={`w-3.5 h-3.5 text-cyan-400 ${isRestarting ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Restart P2P</span>
        </button>

        {/* Panic Wipe / Burn Button */}
        {!showBurnConfirm ? (
          <button
            onClick={() => setShowBurnConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-semibold transition-all shadow-md shadow-red-950/50"
            title="Emergency Burn: Purge all volatile keys and RAM immediately"
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Burn Session</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 bg-red-950 border border-red-500 rounded-lg p-0.5 animate-in fade-in">
            <button
              onClick={() => {
                setShowBurnConfirm(false);
                onBurnAll();
              }}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
            >
              Confirm Wipe
            </button>
            <button
              onClick={() => setShowBurnConfirm(false)}
              className="px-2 py-1 text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
