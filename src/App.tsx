import { useState } from 'react';
import type { ChatMessage, Persona, ApiConfig } from './types';
import { FIREFLY_PERSONA } from './data/personas';
import { sendChatMessage, parseResponseText } from './services/aiService';
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

  // API Configuration (LM Studio local default)
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    provider: 'lmstudio',
    lmStudioUrl: 'http://localhost:1234/v1',
    lmStudioModel: 'local-model',
    geminiApiKey: '',
    openRouterApiKey: '',
    openRouterModel: ''
  });

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

    try {
      const aiResponseText = await sendChatMessage(updatedMessages, currentPersona, apiConfig);
      
      const { emotions, actions } = parseResponseText(aiResponseText);
      const activeEmotion = emotions[0] || 'happy';
      setCurrentEmotion(activeEmotion);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        characterId: currentPersona.id,
        text: aiResponseText,
        emotions,
        actions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
      speakMessage(aiMsg);
    } catch (err) {
      console.error("AI Generation error:", err);
    } finally {
      setIsLoading(false);
    }
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
      }
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

  return (
    <div className="app-container">
      <Scene 
        currentPersona={currentPersona}
        isSpeaking={isSpeaking}
        currentEmotion={currentEmotion}
        onSelectEmotion={(emotion) => setCurrentEmotion(emotion)}
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
          onSaveConfig={(newConfig) => setApiConfig(newConfig)}
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
