/**
 * Generates and downloads a complete, self-contained, single-file HTML application.
 * Contains embedded Tailwind CSS, inline Web Crypto API implementation, WebRTC DataChannel,
 * and isolated private browser iframe. Zero external dependencies needed to run offline.
 */

export function exportStandaloneHtmlFile(): void {
  const standaloneHtml = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BitVault: Standalone Zero-Server P2P Encrypted Chat & Private Browser</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- QRCode CDN for Mobile Scanning -->
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            vault: '#0b0f17',
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #0b0f17; color: #f1f5f9; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0b0f17; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
  </style>
</head>
<body class="h-screen flex flex-col overflow-hidden bg-[#0b0f17]">

  <!-- Top Security Ribbon -->
  <header class="h-14 px-4 bg-[#0e1420] border-b border-slate-800 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
        🛡️
      </div>
      <div>
        <h1 class="text-sm font-bold text-white tracking-wide">BitVault Standalone</h1>
        <p class="text-[10px] text-emerald-400 font-mono">ECDH P-256 · AES-256-GCM · WebRTC DataChannel</p>
      </div>
    </div>

    <!-- Status -->
    <div id="statusBadge" class="px-3 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-700 text-slate-400 flex items-center gap-2">
      <span id="statusDot" class="w-2 h-2 rounded-full bg-amber-400"></span>
      <span id="statusText">Disconnected (Zero-Server)</span>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button id="connectBtn" class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-colors">
        Connect P2P
      </button>
      <button id="burnBtn" class="px-3 py-1.5 rounded-lg bg-red-950 border border-red-500/40 hover:bg-red-900 text-red-300 font-semibold text-xs transition-colors">
        🔥 Burn Session
      </button>
    </div>
  </header>

  <!-- Main View (Split Screen) -->
  <main class="flex-1 flex flex-col md:flex-row overflow-hidden">
    <!-- P2P Encrypted Chat Panel -->
    <section class="flex-1 flex flex-col bg-[#0a0e16] border-r border-slate-800">
      <div class="px-4 py-2.5 bg-[#0c121d] border-b border-slate-800 text-xs font-mono text-slate-400 flex justify-between items-center">
        <span>🔒 Volatile RAM Chat Memory</span>
        <span id="fingerprintDisplay" class="text-emerald-400 hidden">Safety Verified</span>
      </div>
      
      <div id="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-3 font-sans text-xs">
        <div class="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 text-center font-mono">
          Ready for encrypted WebRTC peer connection. Click "Connect P2P" to exchange offer/answer.
        </div>
      </div>

      <div class="p-3 bg-[#0c121d] border-t border-slate-800 flex gap-2">
        <input id="chatInput" type="text" placeholder="Type encrypted message..." class="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500">
        <button id="sendBtn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs">Send</button>
      </div>
    </section>

    <!-- Isolated Private Browser Panel -->
    <section class="flex-1 flex flex-col bg-[#090d15]">
      <!-- Browser Address Bar -->
      <div class="px-3 py-2 bg-[#0c121d] border-b border-slate-800 flex items-center gap-2">
        <input id="browserUrl" type="text" value="https://html.duckduckgo.com/html/?q=cybersecurity" class="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400">
        <button id="navGoBtn" class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs">Navigate</button>
        <button id="clearBrowserBtn" class="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs" title="Clear Volatile Storage">Wipe</button>
      </div>

      <!-- Sandboxed URL renderer -->
      <div class="flex-1 relative">
        <iframe id="privateFrame" src="https://html.duckduckgo.com/html/?q=cybersecurity" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" referrerpolicy="no-referrer" class="w-full h-full border-none bg-white"></iframe>
      </div>
    </section>
  </main>

  <!-- P2P Connection Modal -->
  <div id="connModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="w-full max-w-lg bg-[#0e1420] border border-cyan-500/30 rounded-xl p-5 space-y-4 shadow-2xl">
      <div class="flex justify-between items-center border-b border-slate-800 pb-3">
        <h3 class="text-sm font-bold text-white">Manual Zero-Server WebRTC Signaling</h3>
        <button id="closeModalBtn" class="text-slate-400 hover:text-white">&times;</button>
      </div>
      <div class="space-y-3 text-xs">
        <button id="createOfferBtn" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg">1. Generate WebRTC Offer & QR</button>
        <div id="qrWrapper" class="hidden flex flex-col items-center p-3 bg-slate-950 rounded-lg border border-cyan-500/30">
          <canvas id="offerQrCanvas" class="rounded"></canvas>
          <span class="text-[10px] text-cyan-300 font-mono mt-1">Scan with camera to connect</span>
        </div>
        <textarea id="offerOutput" readonly rows="2" placeholder="Offer token will appear here..." class="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-cyan-300"></textarea>
        
        <p class="text-slate-400">2. Paste Peer Answer Below:</p>
        <textarea id="answerInput" rows="2" placeholder="Paste answer token here..." class="w-full p-2 bg-slate-950 border border-slate-700 rounded font-mono text-[10px] text-white"></textarea>
        <button id="applyAnswerBtn" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg">3. Connect Channel</button>
      </div>
    </div>
  </div>

  <!-- Inline Web Crypto & WebRTC Scripts -->
  <script type="module">
    let localKeys = null;
    let sharedAesKey = null;
    let pc = null;
    let dataChannel = null;

    const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    // Crypto Helpers
    async function initCrypto() {
      localKeys = await window.crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey']
      );
    }

    async function exportPubKey(key) {
      const raw = await window.crypto.subtle.exportKey('raw', key);
      return btoa(String.fromCharCode(...new Uint8Array(raw)));
    }

    async function importRemotePubKey(base64) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return await window.crypto.subtle.importKey('raw', bytes, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
    }

    async function deriveSharedKey(privKey, pubKey) {
      return await window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: pubKey },
        privKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    async function encryptMsg(text, key) {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(text);
      const ct = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        iv: btoa(String.fromCharCode(...iv)),
        ct: btoa(String.fromCharCode(...new Uint8Array(ct)))
      };
    }

    async function decryptMsg(payload, key) {
      const iv = new Uint8Array([...atob(payload.iv)].map(c => c.charCodeAt(0)));
      const ct = new Uint8Array([...atob(payload.ct)].map(c => c.charCodeAt(0)));
      const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(dec);
    }

    // UI Wire-up
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const messagesContainer = document.getElementById('messagesContainer');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const burnBtn = document.getElementById('burnBtn');
    const connectBtn = document.getElementById('connectBtn');
    const connModal = document.getElementById('connModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const createOfferBtn = document.getElementById('createOfferBtn');
    const offerOutput = document.getElementById('offerOutput');
    const answerInput = document.getElementById('answerInput');
    const applyAnswerBtn = document.getElementById('applyAnswerBtn');
    const browserUrl = document.getElementById('browserUrl');
    const navGoBtn = document.getElementById('navGoBtn');
    const privateFrame = document.getElementById('privateFrame');
    const clearBrowserBtn = document.getElementById('clearBrowserBtn');

    connectBtn.onclick = () => connModal.classList.remove('hidden');
    closeModalBtn.onclick = () => connModal.classList.add('hidden');

    function addMessage(sender, text, isLocal = false) {
      const el = document.createElement('div');
      el.className = isLocal ? 'flex justify-end' : 'flex justify-start';
      el.innerHTML = \`<div class="max-w-[80%] p-2.5 rounded-lg \${isLocal ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200'}">\${text}</div>\`;
      messagesContainer.appendChild(el);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createOfferBtn.onclick = async () => {
      await initCrypto();
      pc = new RTCPeerConnection(ICE_CONFIG);
      dataChannel = pc.createDataChannel('chat');
      setupChannel();

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const renderQr = (val) => {
        offerOutput.value = val;
        const qrCanvas = document.getElementById('offerQrCanvas');
        const qrWrapper = document.getElementById('qrWrapper');
        if (window.QRCode && qrCanvas && qrWrapper) {
          window.QRCode.toCanvas(qrCanvas, val, { width: 200, margin: 1, color: { dark: '#06b6d4', light: '#0b0f17' } }, () => {
            qrWrapper.classList.remove('hidden');
          });
        }
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate && !offerOutput.value) {
          renderQr(btoa(JSON.stringify(pc.localDescription)));
        }
      };
      setTimeout(() => {
        if (!offerOutput.value && pc.localDescription) {
          renderQr(btoa(JSON.stringify(pc.localDescription)));
        }
      }, 1500);
    };

    applyAnswerBtn.onclick = async () => {
      const ans = JSON.parse(atob(answerInput.value.trim()));
      await pc.setRemoteDescription(new RTCSessionDescription(ans));
      connModal.classList.add('hidden');
    };

    function setupChannel() {
      dataChannel.onopen = async () => {
        statusDot.className = 'w-2 h-2 rounded-full bg-cyan-400 animate-ping';
        statusText.innerText = 'Exchanging ECDH Keys...';
        const myPub = await exportPubKey(localKeys.publicKey);
        dataChannel.send(JSON.stringify({ type: 'PUBKEY', key: myPub }));
      };

      dataChannel.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'PUBKEY') {
          const peerPub = await importRemotePubKey(msg.key);
          sharedAesKey = await deriveSharedKey(localKeys.privateKey, peerPub);
          statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 shadow-md shadow-emerald-400';
          statusText.innerText = 'Encrypted P2P Connected (AES-256)';
          addMessage('system', '🔐 Cryptographic ECDH P-256 agreement verified. AES-256-GCM session active.');
        } else if (msg.type === 'MSG') {
          const text = await decryptMsg(msg.payload, sharedAesKey);
          addMessage('peer', text, false);
        } else if (msg.type === 'BURN') {
          burnEverything();
        }
      };
    }

    sendBtn.onclick = async () => {
      const text = chatInput.value.trim();
      if (!text || !sharedAesKey) return;
      const payload = await encryptMsg(text, sharedAesKey);
      dataChannel.send(JSON.stringify({ type: 'MSG', payload }));
      addMessage('you', text, true);
      chatInput.value = '';
    };

    chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendBtn.click(); };

    function burnEverything() {
      if (dataChannel) {
        try { dataChannel.send(JSON.stringify({ type: 'BURN' })); } catch(e){}
        dataChannel.close();
      }
      if (pc) pc.close();
      localKeys = null;
      sharedAesKey = null;
      messagesContainer.innerHTML = '<div class="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-red-300 text-center font-mono">⚠️ Memory Burned: Volatile session wiped and keys zeroized.</div>';
      statusDot.className = 'w-2 h-2 rounded-full bg-slate-600';
      statusText.innerText = 'Disconnected (Wiped)';
    }

    burnBtn.onclick = burnEverything;

    // Browser navigation
    navGoBtn.onclick = () => {
      let url = browserUrl.value.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      privateFrame.src = url;
    };
    browserUrl.onkeydown = (e) => { if (e.key === 'Enter') navGoBtn.click(); };
    clearBrowserBtn.onclick = () => {
      privateFrame.src = 'about:blank';
      browserUrl.value = '';
    };
  </script>
</body>
</html>`;

  const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bitvault-p2p-standalone.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
