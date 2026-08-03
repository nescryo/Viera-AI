# Viera — System Architecture & Workflow Guide

This document outlines the system architecture, data flow pipelines, and interactive workflows of **Viera**, making it easy for reviewers and developers to understand how the 3D graphics, local AI, and voice synthesis modules interact.

---

## 1. High-Level Architecture Overview

```mermaid
graph TD
    A[" User Input (Chat / 3D Touch)"] --> B["🖥️ React 19 Frontend UI"]
    
    subgraph "AI & Natural Language Processing"
        B -->|Send Message| C["🧠 LM Studio / Cloud LLM"]
        C -->|Native Japanese Output| D["🌸 Native Anime Japanese Stream"]
    end

    subgraph "Voice Synthesis Engine"
        D -->|Instant Audio Query| E["🎙️ VOICEVOX Server (port 50021)"]
        E -->|WAV Audio Stream| F["🔊 Web Audio API (Headphone Output)"]
    end

    subgraph "Async Translation & UI Render"
        D -->|Async JA -> EN Translate| G["💬 English Subtitle Formatter"]
        G -->|Clean English Text| B
    end

    subgraph "Interactive 3D Viewport"
        A -->|Raycast Click| H["🎨 Three.js MMD 3D Model (Firefly)"]
        H -->|Touch Zone Raycast| I{"Hit Zone Check"}
        I -->|Head Pat: y >= 1.35| J["😳 Blush Texture & Sparkles + Voice"]
        I -->|Ribbon: 1.08 <= y < 1.35| K["😮 Surprised Facial Blendshape + Voice"]
        J --> H
        K --> H
    end
```

---

## 2. Core Workflows

### Workflow 1: Dual-Language Chat & Voice Synthesis Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Chat UI Overlay
    participant LLM as LM Studio (Local LLM)
    participant TTS as VOICEVOX Server
    participant WebAudio as Web Audio Player
    participant Trans as Reverse Translator (JA -> EN)

    User->>UI: Types English Message & Hits Send
    UI->>LLM: Send Conversation History (Japanese System Prompt)
    LLM-->>UI: Streams Native Japanese Anime Text ("おはよう、トレイルブレイザー！")
    
    par Instant Voice Synthesis
        UI->>TTS: POST /audio_query & /synthesis (Speaker ID 0: Shikikoku Metan Ama-ama)
        TTS-->>WebAudio: Returns WAV Audio Blob (0ms Translation Delay)
        WebAudio->>User: Plays Authentic Japanese Anime Voice Dubbing
    and Async Subtitle Formatting
        UI->>Trans: Translate Japanese to English
        Trans-->>UI: Returns Clean English Text ("Good morning, Trailblazer!")
        UI->>User: Displays Clean English Subtitle on Chat Overlay
    end
```

---

### Workflow 2: 3D Raycasting Touch & Head Pat Interaction

```mermaid
flowchart TD
    A["Pointer Click / Touch Event on 3D Viewport"] --> B["Three.js Raycaster Intersects Firefly MMD Mesh"]
    B --> C{"Check Hit Point Position (hitY, relX)"}
    
    C -->|hitY >= 1.35 & relX < 0.28| D["🖐️ HEAD PAT ZONE TRIGGERED"]
    D --> E["1. Apply Porcelain Cheek Blush Canvas Texture"]
    D --> F["2. Tilt Head with Smooth Sine Wave Curve"]
    D --> G["3. Spawn Golden Sparkle Particle Burst"]
    D --> H["4. Play VOICEVOX Japanese Interjection ('E-Eh??' / 'Hmmm...')"]
    
    C -->|1.08 <= hitY < 1.35 & relX < 0.18| I["🎀 CHEST RIBBON ZONE TRIGGERED"]
    I --> J["1. Trigger 'Surprised' Facial Blendshape"]
    I --> K["2. Spawn Golden Sparkle Particle Burst"]
    I --> L["3. Play VOICEVOX Japanese Interjection ('H-Huh...?')"]
    
    C -->|Other Body Parts| M["Ignored (0% False Triggers)"]
```

---

## 3. Component Interaction Matrix

| Component | Responsibility | Key File |
| :--- | :--- | :--- |
| **`App.tsx`** | Central state orchestrator, chat state management, and stream handling. | [`src/App.tsx`](file:///home/nescryo/Projects/Viera/src/App.tsx) |
| **`Scene.tsx`** | Three.js 3D canvas viewport, MMD model loader, blush textures, and Raycasting touch handlers. | [`src/components/3d/Scene.tsx`](file:///home/nescryo/Projects/Viera/src/components/3d/Scene.tsx) |
| **`ttsService.ts`** | VOICEVOX API integration, audio query modulation, and reverse translation bridge. | [`src/services/ttsService.ts`](file:///home/nescryo/Projects/Viera/src/services/ttsService.ts) |
| **`SettingsModal.tsx`** | User configuration for AI providers, VOICEVOX character selection, and server URLs. | [`src/components/ui/SettingsModal.tsx`](file:///home/nescryo/Projects/Viera/src/components/ui/SettingsModal.tsx) |
| **`personas.ts`** | Firefly character definitions, system prompts, and native anime Japanese roleplay rules. | [`src/data/personas.ts`](file:///home/nescryo/Projects/Viera/src/data/personas.ts) |

---

## Summary for Reviewers

Viera operates on a **Dual-Channel Processing Model**:
- **Audio Channel**: Direct native Japanese streaming from LLM to local VOICEVOX engine for 0ms voice synthesis latency.
- **Visual UI Channel**: Clean English subtitle formatting and 60 FPS Three.js 3D touch interactions for a rich, responsive anime companion experience.
