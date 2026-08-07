# 🌸 Viera — 3D Interactive Anime Roleplay Assistant

**Viera** is an ultra-immersive, interactive 3D anime companion application powered by **Three.js / WebGL 3D MMD Models**, **Google OAuth 2.0 Auth**, **DeepSeek AI & LM Studio Local LLM**, and **VOICEVOX Japanese Anime Text-to-Speech Engine**.

Featuring **Firefly (AR-26710)** from *Honkai: Star Rail*, Viera combines 3D raycasting touch interactions, real-time facial blendshape emotions, dynamic user name & Japanese honorifics (`-san` / `-chan`), multi-session conversation history.

---

## ✨ Key Features

- 🔐 **Google OAuth 2.0 Auth & "Complete Your Setup" Onboarding**:
  - Secure Google Identity Services (GIS SDK) client-side login gate.
  - Onboarding setup for handle `@username`, Display Name, Avatar Upload Picker, and Gender selection.
  - Modern c.ai floating label input containers (`.cai-input-group`) & custom glass gender dropdown.


- 🎨 **Interactive 3D MMD Character**:
  - **Head Pat Zone (`y >= 1.35`)**: Triggers soft porcelain cheek blush textures, head tilts, golden sparkle particles, and cute anime interjections.
  - **Ribbon Touch Zone (`1.08 <= y < 1.35`)**: Triggers surprised facial expressions, sparkle bursts, and interjections.
  - **60 FPS Raycasting Optimization**: Ultra-smooth mouse tracking without CPU lag.

- 🎙️ **VOICEVOX Japanese Anime TTS & Subtitle Engine**:
  - Integrated local VOICEVOX engine (`http://localhost:50021`) & Fish Audio / Edge-TTS support.
  - **Customizable Anime Speakers**: Choose from 30+ character styles (Default: **Shikikoku Metan — Ama-ama / Sweet & Calm Anime Girl**).
  - **Dynamic Prosody Modulation**: Automatic pitch and intonation adjustments for punctuation (`!`, `?`, `-`, `...`).

- 🟦 **Deep Royal Blue Modern Dark-Glass UI (`#3b82f6`)**:
  - Sleek glassmorphism UI with curated Deep Royal Blue accent colors, glowing action buttons, and custom scrollbars.

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js**: v18 or higher.
2. **Google OAuth Client ID**: Client ID registered on Google Cloud Console for `http://localhost:5173`.
3. **VOICEVOX Desktop Engine**: VOICEVOX AppImage or executable listening on `http://localhost:50021`.
4. **LM Studio** (Optional for local offline LLM): Server running on `http://localhost:1234/v1`.

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
VITE_DEEPSEEK_API_KEY=your_optional_deepseek_api_key
```

### 2. Installation

```bash
# Clone repository
git clone https://github.com/nescryo/Viera-AI.git
cd Viera

# Install dependencies
npm install
```

### 3. Start VOICEVOX Server

```bash
# Launch VOICEVOX AppImage
~/.voicevox/VOICEVOX.AppImage --no-sandbox
```

### 4. Launch Viera Web App

```bash
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**!

---

## 🛠️ Tech Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Auth & Identity**: Google Identity Services SDK (OAuth 2.0 JWT decoding)
- **3D Graphics Engine**: Three.js + three-stdlib (MMDLoader & Canvas Textures)
- **Voice Engine**: VOICEVOX API (via Vite Proxy `/voicevox_api`) & Web Audio API DSP
- **Styling**: Vanilla CSS (Custom Design System with Glassmorphism & Cyberpunk Neon Tokens)

---