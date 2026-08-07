# Viera — System Architecture & Workflow Guide

This document outlines the system architecture, data flow pipelines, authentication gates, and interactive workflows of **Viera**, making it easy for reviewers and developers to understand how the 3D graphics, local/cloud AI, voice synthesis modules, and user profile honorific systems interact.

---

## 1. High-Level Architecture Overview

```mermaid
graph TD
    A["👤 User Access"] --> B{"Google OAuth Gate"}
    B -->|Not Logged In| C["🔐 Login Gate Modal (Google GIS)"]
    C -->|Success JWT| D{"Complete Your Setup Check"}
    D -->|First Time| E["📝 Setup Onboarding Modal (c.ai Style)"]
    D -->|Setup Complete| F["🖥️ Main App Viewport & 3D Stage"]
    
    subgraph "Conversation History & Multi-Session Storage"
        F --> G["📜 Conversation History Modal (Project Airi)"]
        G <-->|Per-User LocalStorage| H[("viera_sessions_userId")]
    end

    subgraph "AI & Honorific Processing Pipeline"
        F -->|Send Message| I["🏷️ Honorific Resolver (getUserFormattedName)"]
        I -->|Inject Name + -san / -chan| J["🧠 LLM Engine (DeepSeek / LM Studio)"]
        J -->|Native Japanese Speech| K["🌸 Character Output Stream"]
    end

    subgraph "Voice Synthesis & TTS Normalization"
        K -->|Preprocess -san/-chan -> さん/ちゃん| L["🎙️ VOICEVOX Engine (port 50021)"]
        L -->|WAV Audio Stream| M["🔊 Web Audio API DSP (Equalizer & Reverb)"]
    end

    subgraph "Async Translation & Subtitle Formatting"
        K -->|Async JA -> EN Translate| N["💬 Subtitle Translator & Postprocessor"]
        N -->|Clean English Subtitles| F
    end

    subgraph "Interactive 3D Viewport"
        F -->|Raycast Click| O["🎨 Three.js MMD 3D Model (Firefly)"]
        O -->|Touch Zone Raycast| P{"Hit Zone Check"}
        P -->|Head Pat: y >= 1.35| Q["😳 Blush Texture & Sparkles + Voice"]
        P -->|Ribbon: 1.08 <= y < 1.35| R["😮 Surprised Blendshape + Voice"]
        Q --> O
        R --> O
    end
```

---

## 2. Core Workflows

### Workflow 1: Dynamic User Name & Honorific Dubbing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Chat Overlay & State
    participant Honorific as Honorific Resolver
    participant LLM as DeepSeek / LM Studio API
    participant TTS as VOICEVOX TTS Engine
    participant WebAudio as Web Audio API Player

    User->>UI: Types Message & Clicks Send
    UI->>Honorific: Resolve User Profile (nickname & gender)
    Honorific-->>UI: Formats Name + Honorific ("Yokoyama-san" / "Yokoyama-chan")
    UI->>LLM: Send Conversation + System Directive (Address user as "Yokoyama-san")
    LLM-->>UI: Streams Japanese Speech ("おはよう、Yokoyama-san！")
    
    par Instant Voice Synthesis
        UI->>TTS: Preprocess "-san" to "さん" & Send to VOICEVOX (audio_query)
        TTS-->>WebAudio: Returns Clean WAV Audio Stream (0ms "no San" Artifacts)
        WebAudio->>User: Plays Authentic Japanese Anime Voice Dubbing
    and Async Subtitle Translation
        UI->>UI: Format Clean Subtitles ("Good morning, Yokoyama-san!")
    end
```

---

### Workflow 2: Google OAuth 2.0 Auth Gate & Onboarding Setup

```mermaid
flowchart TD
    A["User Opens Viera App"] --> B{"Check LocalStorage ('viera_auth_user')"}
    
    B -->|No Auth Token| C["Display Google OAuth Login Gate Modal"]
    C -->|Click 'Sign in with Google'| D["Google Identity Services (GIS SDK) Popup"]
    D -->|Returns Credential JWT| E["Decode JWT Payload (email, name, picture)"]
    
    E --> F{"Check if Profile Complete ('isSetupComplete')"}
    F -->|No| G["Display 'Complete Your Setup' Modal (c.ai style)"]
    G --> H["1. User inputs @username handle (3-20 chars)"]
    G --> I["2. User inputs Display Name"]
    G --> J["3. User chooses Gender & uploads optional Avatar"]
    J --> K["Save Complete Profile & Unlock Main Dashboard"]
    
    B -->|Auth Valid| K
    F -->|Yes| K
```

---

### Workflow 3: 3D Raycasting Touch & Head Pat Interaction

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
| **`App.tsx`** | Central state orchestrator, auth session gate, history sync, and stream handling. | [`src/App.tsx`](src/App.tsx) |
| **`authService.ts`** | Google OAuth GIS SDK payload decoding and LocalStorage auth session persistence. | [`src/services/authService.ts`](src/services/authService.ts) |
| **`historyService.ts`** | Scoped multi-session CRUD in LocalStorage per user, auto-titling, and active session tracking. | [`src/services/historyService.ts`](src/services/historyService.ts) |
| **`aiService.ts`** | LLM API streaming, dynamic user honorific resolution (`getUserFormattedName`), and system directives. | [`src/services/aiService.ts`](src/services/aiService.ts) |
| **`ttsService.ts`** | VOICEVOX API integration, Hiragana honorific pre-processing (`-san` $\rightarrow$ `さん`), and Web Audio DSP. | [`src/services/ttsService.ts`](src/services/ttsService.ts) |
| **`SetupOnboardingModal.tsx`** | Onboarding profile setup modal with c.ai floating input groups and custom glass gender dropdown. | [`src/components/ui/SetupOnboardingModal.tsx`](src/components/ui/SetupOnboardingModal.tsx) |
| **`ConversationHistoryModal.tsx`** | Project Airi concept multi-session history modal with top `+ New` button and inline rename. | [`src/components/ui/ConversationHistoryModal.tsx`](src/components/ui/ConversationHistoryModal.tsx) |
| **`UserProfileModal.tsx`** | c.ai style profile view/edit modal with avatar upload, gender selector, and clean empty bio state. | [`src/components/ui/UserProfileModal.tsx`](src/components/ui/UserProfileModal.tsx) |
| **`Scene.tsx`** | Three.js 3D canvas viewport, MMD model loader, blush textures, and Raycasting touch handlers. | [`src/components/3d/Scene.tsx`](src/components/3d/Scene.tsx) |

---

## Summary for Reviewers

Viera operates on a **Multi-Layered Interactive Architecture**:
- **Authentication & Onboarding Gate**: Ensures secure Google OAuth login and personalized user setup before accessing Viera.
- **Dynamic Honorific Address Layer**: Automatically addresses the user by their Display Name with gender-aware Japanese honorifics (`-san` / `-chan`).
- **Dual-Channel Processing Model**: Instant VOICEVOX Japanese speech synthesis + clean English subtitle formatting and 60 FPS Three.js 3D touch interactions.
