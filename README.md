# BitVault: P2P Encrypted Chat & Private Browser

Zero-server, peer-to-peer, end-to-end encrypted messaging and file sharing paired with an isolated private web sandbox. No databases, no telemetry, and ephemeral volatile memory.

---

## 📖 App Name
**BitVault: P2P Encrypted Chat & Private Browser**

---

## 💡 What Does the App Do?
BitVault is a decentralized, privacy-first web application designed for secure, untracked peer-to-peer communication and sandboxed web browsing. 

Unlike traditional messaging platforms that route your conversations through centralized cloud databases, BitVault connects two devices **directly** using WebRTC DataChannels. Every message and file transferred between devices is encrypted in the browser using the native Web Cryptography API with **ECDH (Curve P-256)** key agreement and **AES-256-GCM** authenticated symmetric encryption. No chat messages, encryption keys, or browsing logs are ever stored on any server or written to disk.

---

## ⚡ Main Features

1. **True Peer-to-Peer Communication:**
   - Direct device-to-device communication using **WebRTC DataChannels** (`RTCDataChannel`).
   - Zero intermediate chat servers, zero message databases, and zero tracking.

2. **Military-Grade End-to-End Encryption:**
   - **ECDH (Elliptic-Curve Diffie-Hellman, Curve P-256):** Automatic asymmetric key exchange upon establishing a data link.
   - **AES-256-GCM:** 256-bit symmetric encryption with fresh 12-byte initialization vectors (IVs) generated for every single message and file chunk.
   - **Cryptographic Ratcheting & Session Restart:** Instant 1-click **"Restart P2P"** re-negotiates fresh ECDH session keys without dropping the chat.

3. **Visual & Numeric Verification (Safety Numbers):**
   - Signal-style 30-digit safety numbers derived from SHA-256 checksums of both peers' public keys.
   - 8-block chromatic ocular fingerprint for immediate visual verification against Man-in-the-Middle (MITM) attacks.

4. **Multiple Connection Modes:**
   - **1-Click Room:** Instant connection using a clean, normalized room code (`BV-XXXXXX`).
   - **Zero-Server (QR & Token):** Completely air-gappable manual SDP exchange via high-density compressed QR codes or copyable invite URLs.
   - **Local Sandbox Simulator:** Built-in multi-tab BroadcastChannel simulator to test encrypted workflows locally on a single machine.

5. **Encrypted Volatile File & Image Sharing:**
   - Send documents, photos, and files in encrypted 16 KB chunks directly across the peer connection.
   - In-memory assembly with real-time transfer progress bars.
   - Files reside exclusively in RAM as temporary object URLs and are destroyed on session close.

6. **Panic Burn & Zeroization:**
   - **"Burn Session"** panic button sends a wipe signal to the remote peer, terminates the WebRTC connection, and zeroizes all cryptographic buffers in RAM.

7. **Isolated Private Browser Sandbox:**
   - Embedded web panel with an integrated privacy proxy to bypass `X-Frame-Options` and CSP frame restrictions.
   - No cookie storage, no disk history persistence, and referrer-policy shielding.
   - Built-in DuckDuckGo privacy search and quick bookmarks (Wikipedia, OpenStreetMap, EFF, etc.).

---

## 🛠️ Technologies Used

- **Frontend Framework:** React 19, TypeScript
- **Build Tool & Dev Server:** Vite 8, `@vitejs/plugin-react`
- **Styling:** Tailwind CSS v4, Modern Glassmorphism & Cyberpunk Dark Theme
- **P2P Networking & Protocols:** WebRTC (`RTCPeerConnection`, `RTCDataChannel`), PeerJS, BroadcastChannel API
- **Cryptography:** Native W3C Web Cryptography API (`window.crypto.subtle`)
  - ECDH Curve P-256 Key Exchange
  - AES-256-GCM Authenticated Encryption
  - SHA-256 Safety Fingerprint Hashing
- **Security & SSL:** `@vitejs/plugin-basic-ssl` (automatic HTTPS certificate for local network WebCrypto & camera support)
- **Optical Scanning:** `html5-qrcode`, `qrcode`
- **Icons & UI Micro-animations:** `lucide-react`, `motion`
- **Audio Feedback:** Native Web Audio API procedural sound synthesizer (offline key-exchange and message alerts)

---

## 🚀 How Users Use It

### 1. Establish an Encrypted Connection
- **Option A (1-Click Room):**
  1. Open the app on Device 1 and click **Connect**.
  2. Select **1-Click Room** and click **Create Room**. You will receive a code (e.g. `BV-K9X2A`).
  3. On Device 2, open the app, enter the code in **Join Existing Room**, and click **Join Room**.
  4. Both devices will automatically execute the ECDH P-256 key exchange and transition to **Encrypted P2P Connected**.
- **Option B (Zero-Server Optical QR):**
  1. Click **Connect** &rarr; select **Zero-Server (QR)** &rarr; click **Generate Offer**.
  2. Scan the displayed QR code with your mobile camera or copy the join link.
  3. Complete the exchange to establish a direct connection without third-party signaling.

### 2. Verify Session Fingerprint
- Click **Safety Numbers** in the top header.
- Compare the 30-digit safety numbers or the 8 colored visual blocks with your peer to ensure end-to-end authenticity.

### 3. Encrypted Chat & File Sharing
- Send real-time encrypted messages.
- Drag & drop images or documents to transmit them securely in encrypted chunks.

### 4. Re-key Session Anytime
- Click **Restart P2P** in the top navigation bar to generate fresh cryptographic keys and re-ratchet the session on both devices.

### 5. Panic Burn
- Click **Burn Session** &rarr; **Confirm Wipe** to instantly clear all chat history and zeroize cryptographic keys on both devices.

---

## 🌐 Live Website URL / Network Access

- **Localhost:** `https://localhost:3000/`
- **LAN / Cross-Device:** `https://<YOUR_LOCAL_IP>:3000/` (e.g. `https://192.168.1.9:3000/`)

> [!NOTE]
> Because BitVault requires HTTPS for browser WebCrypto API and camera permissions, local dev servers use a self-signed SSL certificate. When accessing via a mobile device or second computer, simply click **Advanced &rarr; Proceed** to bypass the certificate prompt.

---

## 💻 Installation & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Steps

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd bitvault_-p2p-encrypted-chat-&-private-browser
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open the application:**
   - On your desktop: Navigate to **`https://localhost:3000/`**
   - On a second device on the same Wi-Fi: Navigate to **`https://<YOUR_LOCAL_IP>:3000/`**

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📄 License
Apache-2.0
