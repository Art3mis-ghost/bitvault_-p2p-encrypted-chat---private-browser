import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Shield,
  ShieldCheck,
  Flame,
  Lock,
  Download,
  FileText,
  Image as ImageIcon,
  CheckCheck,
  AlertTriangle,
  Radio,
  Eye,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage, ConnectionState } from '../webrtc/p2pTypes';
import { P2PEngine } from '../webrtc/p2pEngine';
import {
  playMessageSentSound,
  playMessageReceivedSound,
  playBurnSound,
} from '../utils/audioFeedback';

interface ChatPanelProps {
  messages: ChatMessage[];
  connectionState: ConnectionState;
  p2pEngine: P2PEngine;
  onOpenConnectModal: () => void;
  onOpenFingerprint: () => void;
  onBurnAll: () => void;
  peerAlias: string;
  localAlias: string;
  onUpdateAlias: (newAlias: string) => void;
  fileProgress: { [fileId: string]: number };
  isPeerTyping: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  connectionState,
  p2pEngine,
  onOpenConnectModal,
  onOpenFingerprint,
  onBurnAll,
  peerAlias,
  localAlias,
  onUpdateAlias,
  fileProgress,
  isPeerTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [tempAlias, setTempAlias] = useState(localAlias);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    if (connectionState !== 'connected') {
      onOpenConnectModal();
      return;
    }

    const text = inputText;
    setInputText('');

    try {
      if (soundEnabled) playMessageSentSound();
      await p2pEngine.sendTextMessage(text);
      p2pEngine.sendTyping(false);
    } catch (err: any) {
      console.error('Failed to send text message:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (connectionState === 'connected') {
      p2pEngine.sendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        p2pEngine.sendTyping(false);
      }, 1500);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (connectionState !== 'connected') {
      onOpenConnectModal();
      return;
    }

    try {
      if (soundEnabled) playMessageSentSound();
      await p2pEngine.sendFile(file);
    } catch (err: any) {
      console.error('Failed to send file:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleBurn = () => {
    if (soundEnabled) playBurnSound();
    onBurnAll();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isConnected = connectionState === 'connected';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col h-full bg-[#0a0e16] border-r border-slate-800/80 transition-all ${
        isDragging ? 'ring-2 ring-emerald-500/50 bg-emerald-950/20' : ''
      }`}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-500 rounded-xl m-2 pointer-events-none">
          <Paperclip className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
          <p className="text-sm font-semibold text-emerald-300">Drop file to encrypt & stream to peer</p>
          <p className="text-xs text-slate-400 mt-1">Chunked over WebRTC DataChannel (AES-256-GCM)</p>
        </div>
      )}

      {/* Chat Header */}
      <div className="px-4 py-3 bg-[#0c121d] border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Peer avatar / state indicator */}
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center font-mono font-bold text-sm text-cyan-400">
              {peerAlias ? peerAlias.substring(0, 2).toUpperCase() : 'P2'}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c121d] ${
                isConnected
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500'
                  : connectionState === 'performing_handshake'
                  ? 'bg-cyan-400 animate-ping'
                  : 'bg-slate-600'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white truncate">{peerAlias || 'Remote Peer'}</span>
              {isConnected && (
                <button
                  onClick={onOpenFingerprint}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                  title="Verify Safety Numbers"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified</span>
                </button>
              )}
            </div>

            {/* Connection status line */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              {isConnected ? (
                <span className="text-emerald-400/90 font-mono text-[10px] flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  AES-256-GCM Ephemeral Link
                </span>
              ) : connectionState === 'performing_handshake' ? (
                <span className="text-cyan-400 font-mono text-[10px] animate-pulse">
                  ECDH P-256 Handshake...
                </span>
              ) : connectionState === 'awaiting_answer' ? (
                <span className="text-amber-400 font-mono text-[10px]">Awaiting Remote Answer</span>
              ) : (
                <span className="text-slate-500 font-mono text-[10px]">Unlinked (Zero Server)</span>
              )}
            </div>
          </div>
        </div>

        {/* Right header buttons */}
        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={soundEnabled ? 'Mute audio cues' : 'Enable audio cues'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Connect / Manage Button */}
          {!isConnected ? (
            <button
              onClick={onOpenConnectModal}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-950/40"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Connect P2P</span>
            </button>
          ) : (
            <button
              onClick={handleBurn}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 text-xs font-medium transition-colors flex items-center gap-1"
              title="Burn session: Immediately zeroes keys, wipes RAM, and closes channel"
            >
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span>Burn</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Zero-Server banner if no messages */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400/80">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Ephemeral P2P Encrypted Vault</h4>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Zero server telemetry. Keys and messages exist strictly in volatile RAM. No history is stored on disk or database.
              </p>
            </div>
            {!isConnected && (
              <div className="pt-2">
                <button
                  onClick={onOpenConnectModal}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/50 hover:opacity-95 transition-all"
                >
                  Start Encrypted Connection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-400 max-w-md text-center leading-relaxed">
                  {msg.text}
                </div>
              </div>
            );
          }

          const isLocal = msg.sender === 'local';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isLocal ? 'items-end' : 'items-start'} group`}
            >
              {/* Sender & timestamp header */}
              <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] text-slate-500 font-mono">
                <span>{isLocal ? 'You' : msg.senderAlias || peerAlias}</span>
                <span>·</span>
                <span>{formatTime(msg.timestamp)}</span>
                {msg.encrypted && <Lock className="w-2.5 h-2.5 text-emerald-400" />}
              </div>

              {/* Bubble content */}
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs shadow-md transition-all ${
                  isLocal
                    ? 'bg-gradient-to-br from-emerald-700 to-emerald-800 text-slate-100 rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Text body */}
                {msg.text && (
                  <p className="whitespace-pre-wrap break-words leading-relaxed select-text font-sans">
                    {msg.text}
                  </p>
                )}

                {/* File Attachment */}
                {msg.file && (
                  <div className="space-y-2 mt-1">
                    {msg.file.isImage && msg.file.url ? (
                      <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40 relative group/img">
                        <img
                          src={msg.file.url}
                          alt={msg.file.name}
                          className="max-h-60 w-auto object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedPreviewImage(msg.file!.url!)}
                        />
                        <button
                          onClick={() => setSelectedPreviewImage(msg.file!.url!)}
                          className="absolute bottom-2 right-2 p-1.5 rounded bg-black/70 text-white text-xs opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Expand</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 p-2 rounded-lg bg-black/30 border border-white/10">
                        <div className="w-8 h-8 rounded bg-slate-800/90 flex items-center justify-center text-cyan-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs truncate text-white">{msg.file.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatFileSize(msg.file.size)}
                          </p>
                        </div>
                        {msg.file.url && (
                          <a
                            href={msg.file.url}
                            download={msg.file.name}
                            className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
                            title="Download decrypted file"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* File In-Progress indicator */}
        {Object.entries(fileProgress).map(([fileId, percent]) => (
          <div key={fileId} className="p-2.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs">
            <div className="flex items-center justify-between mb-1.5 text-cyan-300 font-mono text-[11px]">
              <span>Transferring Encrypted Binary Chunks...</span>
              <span>{percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ))}

        {/* Peer typing indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono px-2 py-1">
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-100" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse delay-200" />
            </div>
            <span>{peerAlias} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 bg-[#0c121d] border-t border-slate-800 shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 disabled:opacity-40 transition-colors"
            title="Attach file (Encrypted & chunked)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={
                isConnected
                  ? 'Send end-to-end encrypted message...'
                  : 'Connect P2P to begin encrypted messaging'
              }
              value={inputText}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 transition-colors flex items-center justify-center shadow-md shadow-emerald-950/50"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Footer disclaimer */}
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 px-1 font-mono">
          <span className="flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-emerald-400" />
            Volatile RAM Memory Only
          </span>
          <span>Zero Server Logs</span>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {selectedPreviewImage && (
        <div
          onClick={() => setSelectedPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedPreviewImage}
              alt="Decrypted preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800 shadow-2xl"
            />
            <button
              onClick={() => setSelectedPreviewImage(null)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
