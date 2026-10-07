import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { X, Camera, SwitchCamera, Image as ImageIcon, AlertCircle, Sparkles } from 'lucide-react';
import { playCipherKeySound } from '../utils/audioFeedback';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
  description?: string;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan WebRTC Connection QR',
  description = 'Point your camera at your peer’s Offer or Answer QR code.',
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerId = 'bitvault-qr-reader';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;

    // Discover available cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length) {
          setCameras(devices);
          // Prefer back/environment camera on mobile
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('rear')
          );
          const defaultCam = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(defaultCam);
          startCamera(defaultCam);
        } else {
          setErrorMessage('No camera found on this device. You can still upload a QR code image below.');
        }
      })
      .catch((err) => {
        console.warn('Camera permission or device discovery error:', err);
        const errStr = String(err || '');
        if (errStr.includes('secure context') || (typeof window !== 'undefined' && !window.isSecureContext)) {
          setErrorMessage('Camera access requires HTTPS in modern browsers. Please reload using HTTPS.');
        } else {
          setErrorMessage('Camera access was blocked or is unavailable. Please grant camera permission or upload a QR image.');
        }
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startCamera = async (cameraId: string) => {
    try {
      await stopScanner();
      setErrorMessage(null);

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      const config: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scanner.start(
        cameraId,
        config,
        (decodedText) => {
          playCipherKeySound();
          stopScanner();
          onScanSuccess(decodedText);
        },
        () => {
          // ignore frame decode misses
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Failed to start QR scanner:', err);
      setErrorMessage('Could not initialize video stream: ' + (err.message || 'Permission denied'));
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleCameraSwitch = (newId: string) => {
    setSelectedCameraId(newId);
    startCamera(newId);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        await stopScanner();
        const html5QrCode = new Html5Qrcode(containerId);
        const result = await html5QrCode.scanFile(file, true);
        playCipherKeySound();
        onScanSuccess(result);
      } catch (err: any) {
        setErrorMessage('Could not recognize a valid QR code in the uploaded image.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0e1420] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-[11px] text-slate-400 font-mono">Real-Time Mobile Optical Scanner</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="p-4 flex flex-col items-center space-y-3">
          <p className="text-xs text-slate-300 text-center">{description}</p>

          {errorMessage && (
            <div className="w-full p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              {typeof window !== 'undefined' && !window.isSecureContext && (
                <a
                  href={window.location.href.replace('http://', 'https://')}
                  className="self-start px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded text-xs transition-colors"
                >
                  Reload via HTTPS
                </a>
              )}
            </div>
          )}

          {/* Scanner Video Container */}
          <div className="relative w-full aspect-square max-w-[300px] rounded-xl overflow-hidden bg-black border-2 border-cyan-500/40 shadow-inner flex items-center justify-center">
            <div id={containerId} className="w-full h-full" />

            {/* Target Reticle Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border border-cyan-400/40 rounded-xl relative">
                  {/* Corner marks */}
                  <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400 -mt-0.5 -ml-0.5 rounded-tl" />
                  <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400 -mt-0.5 -mr-0.5 rounded-tr" />
                  <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400 -mb-0.5 -ml-0.5 rounded-bl" />
                  <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400 -mb-0.5 -mr-0.5 rounded-br" />

                  {/* Animated sweeping laser */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-md shadow-cyan-400 animate-pulse mt-28" />
                </div>
              </div>
            )}
          </div>

          {/* Camera switcher if multiple lenses present */}
          {cameras.length > 1 && (
            <div className="w-full flex items-center justify-between text-xs bg-slate-900/90 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1">
                <SwitchCamera className="w-3.5 h-3.5 text-cyan-400" />
                Switch Camera:
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => handleCameraSwitch(e.target.value)}
                className="bg-slate-950 text-cyan-300 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none"
              >
                {cameras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Camera ${c.id.substring(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Alternative: upload image */}
          <div className="w-full pt-1">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Or Upload QR Screenshot / Photo</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
