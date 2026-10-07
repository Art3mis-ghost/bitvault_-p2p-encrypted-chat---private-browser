import React, { useEffect, useState } from 'react';
import { ShieldCheck, Copy, Check, X, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

interface FingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  fingerprint: {
    safetyNumbers: string;
    hexFingerprint: string;
    colorBlocks: string[];
    peerAlias: string;
  } | null;
  localAlias: string;
}

export const FingerprintModal: React.FC<FingerprintModalProps> = ({
  isOpen,
  onClose,
  fingerprint,
  localAlias,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (fingerprint) {
      QRCode.toDataURL(fingerprint.safetyNumbers, {
        width: 200,
        margin: 1,
        color: {
          dark: '#10b981',
          light: '#0b0f17',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(console.error);
    }
  }, [fingerprint]);

  if (!isOpen || !fingerprint) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fingerprint.safetyNumbers);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0e1420] border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Cryptographic Safety Numbers</h3>
              <p className="text-xs text-emerald-400/80">ECDH P-256 · SHA-256 Fingerprint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Peer relationship banner */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <span className="text-slate-400">
              Local: <span className="text-emerald-400 font-mono font-medium">{localAlias}</span>
            </span>
            <span className="text-slate-600">⇄</span>
            <span className="text-slate-400">
              Remote: <span className="text-cyan-400 font-mono font-medium">{fingerprint.peerAlias}</span>
            </span>
          </div>

          {/* Explanation */}
          <p className="text-xs text-slate-400 leading-relaxed">
            Verify this safety fingerprint with your peer via a secondary verified channel (such as a voice call or in-person). If the numbers match, your peer-to-peer connection is provably immune to Man-in-the-Middle (MITM) attacks.
          </p>

          {/* Safety numbers display (Signal style) */}
          <div className="p-4 bg-slate-950/80 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Safety Number Sequence</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Numbers'}
              </button>
            </div>
            <div className="font-mono text-center text-lg sm:text-xl font-bold tracking-widest text-emerald-400 bg-slate-900/60 p-3 rounded border border-slate-800 selection:bg-emerald-500 selection:text-black">
              {fingerprint.safetyNumbers}
            </div>
          </div>

          {/* Visual Color Grid (Ocular Verification) */}
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2">
              Visual Chromatic Digest (8-Block Checksum)
            </span>
            <div className="grid grid-cols-8 gap-2 p-2 bg-slate-950 rounded-lg border border-slate-800">
              {fingerprint.colorBlocks.map((color, idx) => (
                <div
                  key={idx}
                  className="h-8 rounded shadow-inner border border-white/10 transition-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                  title={`Block ${idx + 1}: ${color}`}
                />
              ))}
            </div>
          </div>

          {/* QR Code Toggle */}
          <div className="border-t border-slate-800/80 pt-4">
            <button
              onClick={() => setShowQr(!showQr)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300 transition-colors"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              {showQr ? 'Hide Verification QR' : 'Show Verification QR'}
            </button>

            {showQr && qrDataUrl && (
              <div className="mt-4 flex flex-col items-center justify-center p-4 bg-slate-950 rounded-lg border border-slate-800">
                <img src={qrDataUrl} alt="Safety Numbers QR" className="w-44 h-44 rounded border border-emerald-500/30" />
                <span className="text-[11px] font-mono text-slate-500 mt-2">Scan with camera to match string</span>
              </div>
            )}
          </div>

          {/* Raw Hex digest */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              Full SHA-256 Digest
            </span>
            <div className="p-2 bg-slate-950 rounded border border-slate-800/60 text-[10px] font-mono text-slate-400 break-all select-all">
              {fingerprint.hexFingerprint}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-semibold transition-colors shadow-lg shadow-emerald-950/40"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
