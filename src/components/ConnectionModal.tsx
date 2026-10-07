import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  KeyRound,
  QrCode,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  Link as LinkIcon,
  Shield,
  AlertCircle,
  Camera,
  Maximize2,
  Download,
  Smartphone,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { P2PEngine } from '../webrtc/p2pEngine';
import { buildOfferJoinUrl } from '../utils/qrPayload';
import { QrScannerModal } from './QrScannerModal';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  p2pEngine: P2PEngine;
  initialOffer?: string;
}

type TabType = 'manual' | 'oneclick' | 'simulator';

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  p2pEngine,
  initialOffer,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialOffer ? 'manual' : 'oneclick');
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual SDP states
  const [manualMode, setManualMode] = useState<'create' | 'join'>(initialOffer ? 'join' : 'create');
  const [generatedOffer, setGeneratedOffer] = useState<string>('');
  const [offerQrUrl, setOfferQrUrl] = useState<string>('');
  const [offerJoinUrl, setOfferJoinUrl] = useState<string>('');
  const [qrFormat, setQrFormat] = useState<'link' | 'raw'>('link');
  const [remoteAnswerInput, setRemoteAnswerInput] = useState<string>('');

  const [remoteOfferInput, setRemoteOfferInput] = useState<string>(initialOffer || '');
  const [generatedAnswer, setGeneratedAnswer] = useState<string>('');
  const [answerQrUrl, setAnswerQrUrl] = useState<string>('');

  // 1-Click PeerJS states
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [roomCreatedId, setRoomCreatedId] = useState<string | null>(null);

  // QR Enlarged Modal state
  const [enlargedQr, setEnlargedQr] = useState<{ title: string; url: string } | null>(null);

  // Camera Scanner Modal state
  const [scannerTarget, setScannerTarget] = useState<'offer' | 'answer' | null>(null);

  useEffect(() => {
    if (initialOffer) {
      setActiveTab('manual');
      setManualMode('join');
      setRemoteOfferInput(initialOffer);
      handleGenerateAnswer(initialOffer);
    }
  }, [initialOffer]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  /* --- Manual SDP handlers --- */
  const handleGenerateOffer = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage('Generating ECDH keypair and gathering ICE candidates...');
    try {
      const offerToken = await p2pEngine.createManualOffer();
      setGeneratedOffer(offerToken);

      const joinLink = buildOfferJoinUrl(offerToken);
      setOfferJoinUrl(joinLink);

      // Generate initial QR code (mobile join link by default for seamless scanning)
      await updateOfferQr(qrFormat === 'link' ? joinLink : offerToken);

      setStatusMessage('Offer ready. Mobile peers can scan the QR code to join instantly.');
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to create offer');
    } finally {
      setLoading(false);
    }
  };

  const updateOfferQr = async (content: string) => {
    const qr = await QRCode.toDataURL(content, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#06b6d4', light: '#0b0f17' },
    });
    setOfferQrUrl(qr);
  };

  const handleToggleQrFormat = async (format: 'link' | 'raw') => {
    setQrFormat(format);
    if (!generatedOffer) return;
    const content = format === 'link' ? offerJoinUrl : generatedOffer;
    await updateOfferQr(content);
  };

  const handleFinalizeAnswer = async (answerText?: string) => {
    const token = (answerText || remoteAnswerInput).trim();
    if (!token) {
      setErrorMessage('Please paste or scan the Answer token from your peer.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await p2pEngine.finalizeManualAnswer(token);
      onClose();
    } catch (e: any) {
      setErrorMessage('Failed to apply answer: ' + (e.message || 'Check answer format'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAnswer = async (offerText?: string) => {
    const token = (offerText || remoteOfferInput).trim();
    if (!token) {
      setErrorMessage('Please paste or scan the Offer token from the room creator.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage('Parsing offer, initiating ECDH, and creating answer...');
    try {
      const answerToken = await p2pEngine.acceptManualOffer(token);
      setGeneratedAnswer(answerToken);
      const qr = await QRCode.toDataURL(answerToken, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#10b981', light: '#0b0f17' },
      });
      setAnswerQrUrl(qr);
      setStatusMessage('Answer generated. Show this QR code or send token to creator.');
    } catch (e: any) {
      setErrorMessage('Error accepting offer: ' + (e.message || 'Invalid format'));
    } finally {
      setLoading(false);
    }
  };

  /* Camera Scanner handlers */
  const handleScanComplete = (scannedText: string) => {
    if (scannerTarget === 'offer') {
      setRemoteOfferInput(scannedText);
      setScannerTarget(null);
      handleGenerateAnswer(scannedText);
    } else if (scannerTarget === 'answer') {
      setRemoteAnswerInput(scannedText);
      setScannerTarget(null);
      handleFinalizeAnswer(scannedText);
    }
  };

  /* 1-Click PeerJS handlers */
  const handleCreate1ClickRoom = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage('Provisioning secure P2P room channel...');
    try {
      const id = await p2pEngine.createPeerJSRoom();
      setRoomCreatedId(id);
      setStatusMessage(`Room created: ${id}. Waiting for peer to join...`);
    } catch (e: any) {
      setErrorMessage('Could not create room: ' + (e.message || 'Network broker issue'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin1ClickRoom = async () => {
    let cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please enter a room code');
      return;
    }
    if (!cleanCode.startsWith('BV-') && cleanCode.length <= 8) {
      cleanCode = 'BV-' + cleanCode;
    }
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(`Connecting to room ${cleanCode}...`);
    try {
      await p2pEngine.joinPeerJSRoom(cleanCode);
      onClose();
    } catch (e: any) {
      setErrorMessage(e.message || 'Could not join room. Check room code.');
    } finally {
      setLoading(false);
    }
  };

  /* Simulator handler */
  const handleStartSimulation = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await p2pEngine.connectLocalSimulator();
      onClose();
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadQrImage = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-xl bg-[#0d121c] border border-cyan-500/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Establish P2P Encrypted Channel</h3>
                <p className="text-xs text-slate-400">WebRTC DataChannel · Zero Server Storage</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab selection (Clean segmented control) */}
          <div className="px-5 pt-4 pb-2">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-medium">
              <button
                onClick={() => {
                  setActiveTab('manual');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'manual'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Zero-Server (QR)</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('oneclick');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'oneclick'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>1-Click Room</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('simulator');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'simulator'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sandbox Test</span>
              </button>
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-200 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {typeof window !== 'undefined' && !window.isSecureContext && (
                  <a
                    href={window.location.href.replace('http://', 'https://')}
                    className="self-start px-2.5 py-1 bg-red-500 hover:bg-red-400 text-white font-semibold rounded text-xs transition-colors"
                  >
                    Switch to HTTPS ({window.location.host})
                  </a>
                )}
              </div>
            )}

            {/* Status Message */}
            {statusMessage && !errorMessage && (
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 flex items-start gap-2">
                <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* TAB 1: ZERO-SERVER MANUAL SIGNALING WITH QR CODE GENERATOR */}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setManualMode('create')}
                    className={`flex-1 py-1.5 text-center rounded-md font-medium transition-colors ${
                      manualMode === 'create'
                        ? 'bg-slate-800 text-cyan-300 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Host: Generate Offer & QR
                  </button>
                  <button
                    onClick={() => setManualMode('join')}
                    className={`flex-1 py-1.5 text-center rounded-md font-medium transition-colors ${
                      manualMode === 'join'
                        ? 'bg-slate-800 text-emerald-300 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Peer: Scan / Join Room
                  </button>
                </div>

                {manualMode === 'create' ? (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                      <strong>Zero-Server P2P:</strong> Generates a compressed WebRTC Offer token and high-contrast QR code. Mobile users can scan this QR code with their camera to join directly!
                    </div>

                    {!generatedOffer ? (
                      <button
                        onClick={handleGenerateOffer}
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:opacity-95 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>{loading ? 'Generating Offer & QR Code...' : 'Generate Connection Offer & QR Code'}</span>
                      </button>
                    ) : (
                      <div className="space-y-4">
                        {/* Interactive QR Code Display Container */}
                        <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/30 flex flex-col items-center space-y-3">
                          <div className="w-full flex items-center justify-between text-xs">
                            <span className="font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
                              <Smartphone className="w-4 h-4 text-cyan-400" />
                              Scan with Mobile Camera to Join
                            </span>

                            {/* Format toggle: Join Link vs Raw Token */}
                            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
                              <button
                                onClick={() => handleToggleQrFormat('link')}
                                className={`px-2 py-0.5 rounded ${
                                  qrFormat === 'link' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                                }`}
                                title="Encodes full URL: opens app automatically on mobile"
                              >
                                Join URL
                              </button>
                              <button
                                onClick={() => handleToggleQrFormat('raw')}
                                className={`px-2 py-0.5 rounded ${
                                  qrFormat === 'raw' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
                                }`}
                                title="Encodes raw compressed token: for in-app scanner"
                              >
                                Raw Token
                              </button>
                            </div>
                          </div>

                          {/* QR Code Canvas/Image */}
                          {offerQrUrl && (
                            <div className="relative group p-2 bg-[#0b0f17] rounded-xl border border-cyan-500/40 shadow-xl shadow-cyan-950/30 flex flex-col items-center">
                              <img
                                src={offerQrUrl}
                                alt="Offer QR Code"
                                className="w-56 h-56 sm:w-64 sm:h-64 rounded-lg object-contain cursor-pointer transition-transform group-hover:scale-[1.02]"
                                onClick={() =>
                                  setEnlargedQr({
                                    title: 'WebRTC Connection Offer QR Code',
                                    url: offerQrUrl,
                                  })
                                }
                              />
                              <p className="text-[10px] text-slate-500 font-mono mt-1">
                                Point iPhone / Android Camera or In-App Scanner
                              </p>
                            </div>
                          )}

                          {/* Quick QR Actions */}
                          <div className="flex items-center gap-2 pt-1 w-full">
                            <button
                              onClick={() => copyToClipboard(offerJoinUrl || generatedOffer, 'link')}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-colors flex items-center justify-center gap-1.5"
                            >
                              {copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copied === 'link' ? 'Link Copied' : 'Copy Mobile Join Link'}</span>
                            </button>

                            <button
                              onClick={() =>
                                setEnlargedQr({
                                  title: 'WebRTC Connection Offer QR Code',
                                  url: offerQrUrl,
                                })
                              }
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                              title="Enlarge Fullscreen QR"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => downloadQrImage(offerQrUrl, 'bitvault-offer-qr.png')}
                              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                              title="Download QR Image (.png)"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Remote Answer input (Step 2 of handshake) */}
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-slate-300">
                              Peer&apos;s Answer Payload:
                            </label>
                            <button
                              onClick={() => setScannerTarget('answer')}
                              className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Scan Answer QR with Camera</span>
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Paste or scan answer token from peer..."
                            value={remoteAnswerInput}
                            onChange={(e) => setRemoteAnswerInput(e.target.value)}
                            className="w-full p-2 bg-slate-950 rounded-lg border border-slate-700 text-[11px] font-mono text-cyan-300 resize-none focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={() => handleFinalizeAnswer()}
                            disabled={loading || !remoteAnswerInput.trim()}
                            className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                          >
                            <span>Complete Handshake & Connect</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* JOIN ROOM MODE */
                  <div className="space-y-4">
                    <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                      Scan the host&apos;s Offer QR Code using your camera, or paste the offer token / link below.
                    </div>

                    <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-300">
                          Host Offer Token / URL:
                        </label>
                        <button
                          onClick={() => setScannerTarget('offer')}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Scan Offer QR with Camera</span>
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Paste offer token or scan QR code with camera..."
                        value={remoteOfferInput}
                        onChange={(e) => setRemoteOfferInput(e.target.value)}
                        className="w-full p-2 bg-slate-950 rounded-lg border border-slate-700 text-[11px] font-mono text-cyan-300 resize-none focus:outline-none focus:border-cyan-400"
                      />

                      <button
                        onClick={() => handleGenerateAnswer()}
                        disabled={loading || !remoteOfferInput.trim()}
                        className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-950/40"
                      >
                        {loading ? 'Processing Offer...' : 'Generate Answer & QR Code'}
                        <KeyRound className="w-4 h-4" />
                      </button>
                    </div>

                    {generatedAnswer && (
                      <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between text-xs">
                          <span className="font-mono text-emerald-400 font-semibold">Your Answer QR Code</span>
                          <button
                            onClick={() => copyToClipboard(generatedAnswer, 'answer')}
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                          >
                            {copied === 'answer' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied === 'answer' ? 'Copied' : 'Copy Token'}
                          </button>
                        </div>

                        {answerQrUrl && (
                          <div className="p-2 bg-[#0b0f17] rounded-xl border border-emerald-500/40 shadow-xl flex flex-col items-center">
                            <img
                              src={answerQrUrl}
                              alt="Answer QR Code"
                              className="w-56 h-56 rounded-lg object-contain cursor-pointer"
                              onClick={() =>
                                setEnlargedQr({
                                  title: 'WebRTC Connection Answer QR Code',
                                  url: answerQrUrl,
                                })
                              }
                            />
                            <p className="text-[10px] text-slate-400 font-mono mt-1 text-center">
                              Show this to the host or copy token to finish connecting!
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 1-CLICK PEERJS ROOM */}
            {activeTab === 'oneclick' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed">
                  Connects directly using ephemeral WebRTC signaling. Text and files are sent exclusively over an encrypted peer-to-peer data channel (never stored on any server).
                </div>

                {!roomCreatedId ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Create Room Box */}
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
                          Host New Room
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Generate a secure room code and invite your peer with 1 click.
                        </p>
                      </div>
                      <button
                        onClick={handleCreate1ClickRoom}
                        disabled={loading}
                        className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
                      >
                        {loading ? 'Creating...' : 'Create Room'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Join Room Box */}
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
                          Join Existing Room
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Enter the code provided by the room creator.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="e.g. BV-9A82X"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 uppercase focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          onClick={handleJoin1ClickRoom}
                          disabled={loading || !joinCodeInput.trim()}
                          className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 font-semibold text-xs border border-cyan-500/30 transition-colors flex items-center justify-center gap-2"
                        >
                          {loading ? 'Joining...' : 'Join Room'}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Room Created State */
                  <div className="p-5 rounded-xl bg-slate-900 border border-cyan-500/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                        Your Room Code:
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Listening for peer
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-xl font-mono font-bold text-cyan-300 tracking-wider">
                        {roomCreatedId}
                      </span>
                      <button
                        onClick={() => copyToClipboard(roomCreatedId, 'code')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs transition-colors font-medium border border-cyan-500/30"
                      >
                        {copied === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === 'code' ? 'Copied' : 'Copy Code'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Have your peer open BitVault, choose &quot;1-Click Room&quot;, and paste code{' '}
                      <strong className="text-cyan-300 font-mono">{roomCreatedId}</strong>. Handshake starts automatically upon connection!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: LOCAL CRYPTOGRAPHIC SIMULATOR */}
            {activeTab === 'simulator' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-purple-300">
                    <Sparkles className="w-5 h-5" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider">
                      Instant Multi-Tab / Virtual Sandbox
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Test the end-to-end cryptographic handshake right now without needing a separate device.
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Clicking below initializes a secondary cryptographic peer in volatile memory. Both instances will perform the full ECDH P-256 key agreement, derive shared AES-GCM 256-bit keys, compute safety fingerprints, and allow real-time encrypted messaging and file streaming!
                  </p>
                  <button
                    onClick={handleStartSimulation}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50"
                  >
                    {loading ? 'Initializing Simulation...' : 'Launch Cryptographic Sandbox'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950/70 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>P-256 ECDH + AES-256-GCM Hardware Accelerated</span>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Enlarged QR Modal */}
      {enlargedQr && (
        <div
          onClick={() => setEnlargedQr(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-6 bg-[#0e1420] border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm w-full"
          >
            <div className="w-full flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white">{enlargedQr.title}</h4>
              <button
                onClick={() => setEnlargedQr(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={enlargedQr.url}
              alt="Enlarged QR"
              className="w-72 h-72 rounded-xl border border-cyan-500/30 bg-[#0b0f17] p-2"
            />
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Hold camera ~1-2 feet away for instant focus lock
            </p>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={!!scannerTarget}
        onClose={() => setScannerTarget(null)}
        onScanSuccess={handleScanComplete}
        title={scannerTarget === 'offer' ? 'Scan Room Offer QR' : 'Scan Peer Answer QR'}
        description={
          scannerTarget === 'offer'
            ? 'Point camera at host’s WebRTC Offer QR code.'
            : 'Point camera at peer’s WebRTC Answer QR code.'
        }
      />
    </>
  );
};
