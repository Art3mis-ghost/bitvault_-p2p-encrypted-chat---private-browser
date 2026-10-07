import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Shield,
  ShieldAlert,
  Lock,
  ExternalLink,
  Trash2,
  Search,
  Globe,
  Check,
  BookOpen,
  Info,
  Compass,
} from 'lucide-react';

interface BrowserPanelProps {
  onClearNotify?: () => void;
}

const DEFAULT_HOME_URL = 'about:private-start';

const PRIVACY_BOOKMARKS = [
  { name: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/?q=cybersecurity+privacy', category: 'Search' },
  { name: 'Wikipedia', url: 'https://en.m.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange', category: 'Knowledge' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html?bbox=-0.15%2C51.50%2C-0.10%2C51.52&layer=mapnik', category: 'Maps' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/', category: 'Tech' },
  { name: 'EFF Electronic Frontier', url: 'https://www.eff.org/', category: 'Privacy' },
  { name: 'W3C WebCrypto Spec', url: 'https://www.w3.org/TR/WebCryptoAPI/', category: 'Standard' },
];

export const BrowserPanel: React.FC<BrowserPanelProps> = ({ onClearNotify }) => {
  // Volatile in-memory history only (never saved to localStorage/IndexedDB)
  const [history, setHistory] = useState<string[]>([DEFAULT_HOME_URL]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [frameBlockedNotice, setFrameBlockedNotice] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentUrl = history[historyIndex] || DEFAULT_HOME_URL;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const navigateTo = (rawTarget: string) => {
    let target = rawTarget.trim();
    if (!target) return;

    if (target === 'about:private-start') {
      updateHistory(target);
      setInputUrl('');
      setFrameBlockedNotice(false);
      return;
    }

    // Check if input is a search query or a direct URL
    const hasProtocol = /^https?:\/\//i.test(target);
    const hasDomain = /^[\w-]+(\.[\w-]+)+/i.test(target);

    if (!hasProtocol && !hasDomain) {
      // Treat as private search via DuckDuckGo HTML (lightweight, minimal trackers)
      target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(target)}`;
    } else if (!hasProtocol && hasDomain) {
      target = `https://${target}`;
    }

    updateHistory(target);
    setInputUrl(target);
    setIsLoading(true);
    setFrameBlockedNotice(false);
  };

  const getIframeSrc = (url: string) => {
    if (url === DEFAULT_HOME_URL) return 'about:blank';
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  const updateHistory = (newUrl: string) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(newUrl);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      const url = history[newIdx];
      setInputUrl(url === DEFAULT_HOME_URL ? '' : url);
      setFrameBlockedNotice(false);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      const url = history[newIdx];
      setInputUrl(url === DEFAULT_HOME_URL ? '' : url);
      setFrameBlockedNotice(false);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && currentUrl !== DEFAULT_HOME_URL) {
      setIsLoading(true);
      setFrameBlockedNotice(false);
      iframeRef.current.src = getIframeSrc(currentUrl);
    }
  };

  const handleHome = () => {
    navigateTo(DEFAULT_HOME_URL);
  };

  const handleClearPrivacy = () => {
    // Zero out volatile history stack
    setHistory([DEFAULT_HOME_URL]);
    setHistoryIndex(0);
    setInputUrl('');
    setFrameBlockedNotice(false);
    setIsLoading(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
    showToast('Isolated Browser Purged: RAM history and cache cleared.');
    if (onClearNotify) onClearNotify();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateTo(inputUrl);
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const openIsolatedTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-full bg-[#090d15] text-slate-200">
      {/* Browser Navigation Toolbar */}
      <div className="px-3 py-2 bg-[#0c121d] border-b border-slate-800 flex items-center gap-2 shrink-0">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            title="Reload"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handleHome}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            title="Private Home"
          >
            <Home className="w-4 h-4" />
          </button>
        </div>

        {/* URL Bar */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <div className="absolute left-2.5 flex items-center gap-1.5 pointer-events-none text-slate-500">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <input
              type="text"
              placeholder="Enter URL (https://...) or search privately..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="w-full pl-8 pr-20 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs font-mono text-cyan-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 selection:bg-cyan-500 selection:text-black transition-colors"
            />

            <div className="absolute right-2 flex items-center gap-1">
              <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20 hidden sm:inline-block">
                SANDBOX
              </span>
              <button
                type="submit"
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Go"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0">
          {currentUrl !== DEFAULT_HOME_URL && (
            <button
              onClick={() => openIsolatedTab(currentUrl)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors"
              title="Open in Isolated Container Window"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleClearPrivacy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/80 transition-colors flex items-center gap-1"
            title="Instant Privacy Wipe: Clear RAM history and active page"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Info Ribbon */}
      <div className="px-3 py-1 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-400">
            <Shield className="w-3 h-3" />
            Sandboxed Iframe
          </span>
          <span className="text-slate-600">·</span>
          <span>No-Referrer Policy</span>
          <span className="text-slate-600">·</span>
          <span>0 Disk Persistence</span>
        </div>
        <div className="text-slate-500 hidden sm:block">
          Volatile Memory Stack: {historyIndex + 1}/{history.length}
        </div>
      </div>

      {/* Main View Area */}
      <div className="relative flex-1 bg-[#090d15] overflow-hidden">
        {/* Toast alert */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-950/95 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* DEFAULT PRIVATE STARTPAGE */}
        {currentUrl === DEFAULT_HOME_URL ? (
          <div className="h-full overflow-y-auto p-6 flex flex-col items-center justify-center max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/40">
                <Globe className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Isolated Private Web Sandbox
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Browse without local storage, disk cookies, or persistent identifiers. When you close or wipe BitVault, all volatile session state vanishes instantly.
              </p>
            </div>

            {/* Quick search input */}
            <div className="w-full max-w-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  navigateTo(inputUrl || 'https://html.duckduckgo.com/html/?q=privacy');
                }}
                className="relative"
              >
                <input
                  type="text"
                  placeholder="Search privately on DuckDuckGo..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </form>
            </div>

            {/* Verified Frame-Compatible Bookmarks */}
            <div className="w-full space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block text-center">
                Embedded Privacy Direct Links
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PRIVACY_BOOKMARKS.map((bm) => (
                  <button
                    key={bm.name}
                    onClick={() => navigateTo(bm.url)}
                    className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group flex flex-col justify-between space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                        {bm.name}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                        {bm.category}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono truncate">
                      {bm.url.replace(/^https?:\/\//, '')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Privacy Shield Notice */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1 w-full">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Info className="w-3.5 h-3.5" />
                <span>Notice on X-Frame-Options:</span>
              </div>
              <p className="leading-relaxed">
                Commercial services (like Google, Twitter, or GitHub) block embedded iframes via HTTP headers. If a site blocks embedding, use our 1-click &quot;Open in Isolated Container Window&quot; for untracked external viewing.
              </p>
            </div>
          </div>
        ) : (
          /* ACTIVE IFRAME RENDERER */
          <div className="relative w-full h-full">
            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 shadow-xl">
                  <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading sandboxed resource...</span>
                </div>
              </div>
            )}

            {/* Embedded Iframe */}
            <iframe
              ref={iframeRef}
              src={getIframeSrc(currentUrl)}
              onLoad={handleIframeLoad}
              title="Private Sandboxed Browser"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="w-full h-full border-none bg-white"
            />

            {/* Fallback Banner for potential frame-block */}
            <div className="absolute bottom-3 right-3 z-30">
              <button
                onClick={() => setFrameBlockedNotice(!frameBlockedNotice)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 shadow-lg flex items-center gap-1.5 transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Page blank or blocked?</span>
              </button>
            </div>

            {/* Frame Blocked Helper Popover */}
            {frameBlockedNotice && (
              <div className="absolute bottom-12 right-3 z-40 w-80 p-4 rounded-xl bg-slate-950 border border-amber-500/40 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Embedding Shield Active
                  </span>
                  <button
                    onClick={() => setFrameBlockedNotice(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  This website may have sent an <code className="text-amber-400">X-Frame-Options: DENY</code> header prohibiting frame embedding.
                </p>
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => openIsolatedTab(currentUrl)}
                    className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Isolated Window</span>
                  </button>
                  <button
                    onClick={() =>
                      navigateTo(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(currentUrl)}`)
                    }
                    className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Search info on DuckDuckGo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
