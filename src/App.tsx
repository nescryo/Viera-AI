import { useState, useCallback } from 'react';
import type { ChatMessage, Persona, ApiConfig } from './types';
import { FIREFLY_PERSONA } from './data/personas';
import { sendStreamingChatMessage, parseResponseText } from './services/aiService';
import { ttsService } from './services/ttsService';

import { Header } from './components/ui/Header';
import { ChatOverlay } from './components/ui/ChatOverlay';
import { SettingsModal } from './components/ui/SettingsModal';
import { ModelUploaderModal } from './components/ui/ModelUploaderModal';
import { Scene } from './components/3d/Scene';

import './App.css';

export function App() {
  // Single dedicated 3D Roleplay Character: Firefly
  const [currentPersona] = useState<Persona>(FIREFLY_PERSONA);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState<string>('Neutral');

  // Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  // API Configuration (Auto-detects DeepSeek from .env or localStorage)
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const saved = localStorage.getItem('viera_api_config');
    const envKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          provider: parsed.provider || 'deepseek',
          deepseekModel: parsed.deepseekModel || 'deepseek-chat',
          deepseekApiKey: parsed.deepseekApiKey || envKey || ''
        };
      } catch (e) {
        console.warn("Failed to parse saved apiConfig:", e);
      }
    }
    return {
      provider: 'deepseek',
      lmStudioUrl: 'http://localhost:1234/v1',
      lmStudioModel: 'local-model',
      deepseekApiKey: envKey || '',
      deepseekModel: 'deepseek-chat',
      geminiApiKey: '',
      openRouterApiKey: '',
      openRouterModel: '',
      ttsProvider: 'voicevox',
      voicevoxSpeakerId: 0
    };
  });

  const handleSaveConfig = (newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    localStorage.setItem('viera_api_config', JSON.stringify(newConfig));
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      characterId: currentPersona.id,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    const aiMsgId = (Date.now() + 1).toString();
    const placeholderAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      characterId: currentPersona.id,
      text: '',
      emotions: [],
      actions: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, placeholderAiMsg]);

    let updateFrameId: number | null = null;
    let latestText = '';

    sendStreamingChatMessage(
      updatedMessages,
      currentPersona,
      apiConfig,
      (_token, fullTextSoFar) => {
        latestText = fullTextSoFar;
        const { emotions } = parseResponseText(fullTextSoFar);
        
        // Auto-trigger 3D facial blendshapes in real-time as emotion tags arrive!
        if (emotions.length > 0) {
          const activeEmotion = emotions[emotions.length - 1];
          setCurrentEmotion(activeEmotion);
        }

        // Stage 3.1.3: Throttle React state re-renders to 60 FPS (1 frame per rAF) to eliminate 3D viewport stutter
        if (!updateFrameId) {
          updateFrameId = requestAnimationFrame(() => {
            updateFrameId = null;
            const { emotions: currEmotions, actions: currActions } = parseResponseText(latestText);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMsgId
                  ? { ...msg, text: latestText, emotions: currEmotions, actions: currActions }
                  : msg
              )
            );
          });
        }
      },
      (fullText, emotions, actions) => {
        if (updateFrameId) {
          cancelAnimationFrame(updateFrameId);
          updateFrameId = null;
        }
        setIsLoading(false);
        const activeEmotion = emotions[0] || 'happy';
        setCurrentEmotion(activeEmotion);

        const finalMsg: ChatMessage = {
          id: aiMsgId,
          sender: 'ai',
          characterId: currentPersona.id,
          text: fullText,
          emotions,
          actions,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMsgId ? finalMsg : msg))
        );

        speakMessage(finalMsg);

        // Async Reverse Translation: Display ONLY English Translated Text on Chat Screen!
        if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(fullText)) {
          ttsService.translateJapaneseToEnglish(fullText).then((enSub) => {
            if (enSub && enSub !== fullText) {
              const { emotions: currEmotions, actions: currActions } = parseResponseText(fullText);
              const emotionPrefix = currEmotions.length > 0 ? `[${currEmotions[0]}] ` : '';
              const actionPrefix = currActions.length > 0 ? `*${currActions[0]}* ` : '';
              const englishOnlyText = `${emotionPrefix}${actionPrefix}${enSub}`;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMsgId ? { ...msg, text: englishOnlyText } : msg
                )
              );
            }
          });
        }
      },
      (err) => {
        if (updateFrameId) {
          cancelAnimationFrame(updateFrameId);
          updateFrameId = null;
        }
        console.error("Streaming error:", err);
        setIsLoading(false);
      }
    );
  };

  const speakMessage = (msg: ChatMessage) => {
    setActiveSpeakingId(msg.id);
    setIsSpeaking(true);

    ttsService.speak(
      msg.text,
      currentPersona,
      () => {
        setIsSpeaking(true);
      },
      () => {
        setIsSpeaking(false);
        setActiveSpeakingId(null);
      },
      undefined,
      apiConfig
    );
  };

  const stopSpeaking = () => {
    ttsService.stop();
    setIsSpeaking(false);
    setActiveSpeakingId(null);
  };

  const handleRegenerateResponse = () => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.text);
    }
  };

  const handleSelectEmotion = useCallback((emotion: string) => {
    setCurrentEmotion(emotion);
  }, []);

  return (
    <div className="app-container">
      <Scene 
        currentPersona={currentPersona}
        isSpeaking={isSpeaking}
        currentEmotion={currentEmotion}
        onSelectEmotion={handleSelectEmotion}
        apiConfig={apiConfig}
      />

      <Header
        currentPersona={currentPersona}
        onOpenSettings={() => setShowSettings(true)}
        onOpenModelUploader={() => setShowUploader(true)}
        apiConfig={apiConfig}
      />

      <ChatOverlay
        messages={messages}
        currentPersona={currentPersona}
        onSendMessage={handleSendMessage}
        onRegenerateResponse={handleRegenerateResponse}
        onSpeakMessage={speakMessage}
        onStopSpeaking={stopSpeaking}
        isSpeaking={isSpeaking}
        activeSpeakingId={activeSpeakingId}
        isLoading={isLoading}
      />

      {showSettings && (
        <SettingsModal
          apiConfig={apiConfig}
          onSaveConfig={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showUploader && (
        <ModelUploaderModal
          onLoadModelFile={(file) => {
            console.log("Loaded custom 3D model file:", file.name);
          }}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  );
}

export default App;
