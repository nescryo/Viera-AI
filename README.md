# 🌸 Viera — 3D Interactive Anime Roleplay Assistant

**Viera** is an ultra-immersive, interactive 3D anime companion application powered by **Three.js / WebGL 3D MMD Models**, **LM Studio Local AI**, and **VOICEVOX Japanese Anime Text-to-Speech Engine**.

Featuring **Firefly (AR-26710)** from *Honkai: Star Rail*, Viera combines 60 FPS 3D raycasting touch interactions, real-time facial blendshape emotions, instant English-to-Japanese anime voice dubbing, and a sleek modern dark-glass UI.

---

## ✨ Key Features

- 🎨 **Interactive 3D MMD Character**:
  - **Head Pat Zone (`y >= 1.35`)**: Triggers soft porcelain cheek blush textures, head tilts, golden sparkle particles, and cute anime interjections.
  - **Ribbon Touch Zone (`1.08 <= y < 1.35`)**: Triggers surprised facial expressions, sparkle bursts, and interjections.
  - **60 FPS Raycasting Optimization**: Ultra-smooth mouse tracking without CPU lag.

- 🎙️ **VOICEVOX Japanese Anime TTS**:
  - Integrated local VOICEVOX engine (`http://localhost:50021`).
  - **Customizable Anime Speakers**: Choose from 30+ character styles (Default: **Shikikoku Metan — Ama-ama / Sweet & Calm Anime Girl**).
  - **Dynamic Prosody Modulation**: Automatic pitch and intonation adjustments for punctuation (`!`, `?`, `-`, `...`).

- 🌸 **English UI Text + Authentic Japanese Dubbing**:
  - Chat screen displays **100% clean English text** for comfortable reading.
  - Headphones play **authentic Japanese anime voice dubbing** translated on-the-fly.

- ⚙️ **Modular AI Settings**:
  - Compatible with **LM Studio** (Local offline LLM) and Demo roleplay engine.
  - Scrollable modal with sticky save controls.

---

## 🚀 Getting Started

### Prerequisites
1. **Node.js**: v18 or higher.
2. **VOICEVOX Desktop Engine**: VOICEVOX AppImage or executable listening on `http://localhost:50021`.
3. **LM Studio** (Optional for local AI): Server running on `http://localhost:1234/v1`.

### 1. Installation

```bash
# Clone repository
git clone https://github.com/nescryo/Viera-AI.git
cd Viera

# Install dependencies
npm install
```

### 2. Start VOICEVOX Server

```bash
# Launch VOICEVOX AppImage
~/.voicevox/VOICEVOX.AppImage --no-sandbox
```

### 3. Launch Viera Web App

```bash
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**!

---

## 🛠️ Tech Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **3D Graphics Engine**: Three.js + three-stdlib (MMDLoader & Canvas Textures)
- **Voice Engine**: VOICEVOX API (via Vite Proxy `/voicevox_api`)
- **Styling**: Vanilla CSS (Custom Design System with Glassmorphism & Cyberpunk Neon Tokens)

---

## 📜 License

Distributed under the MIT License. Built with ❤️ for Honkai: Star Rail and Anime AI Companion enthusiasts.
