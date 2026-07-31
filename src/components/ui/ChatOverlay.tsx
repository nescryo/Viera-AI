import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Persona } from '../../types';
import { 
  Send, Volume2, VolumeX, Copy, Check, ChevronLeft, ChevronRight, 
  Mic, MicOff, ThumbsUp, ThumbsDown, Sparkles, Smile
} from 'lucide-react';

interface ChatOverlayProps {
  messages: ChatMessage[];
  currentPersona: Persona;
  onSendMessage: (text: string) => void;
  onRegenerateResponse: () => void;
  onSpeakMessage: (msg: ChatMessage) => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
  activeSpeakingId: string | null;
  isLoading: boolean;
}

export const ChatOverlay: React.FC<ChatOverlayProps> = ({
  messages,
  currentPersona,
  onSendMessage,
  onRegenerateResponse,
  onSpeakMessage,
  onStopSpeaking,
  isSpeaking,
  activeSpeakingId,
  isLoading
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFormattedText = (text: string) => {
    const cleanText = text.replace(/\[(.*?)\]/g, '<span class="emotion-tag">$1</span>');
    const formatted = cleanText.replace(
      /\*(.*?)\*/g, 
      '<em class="cai-action-text">*$1*</em>'
    );

    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="chat-overlay-container glass-panel fade-in">
      <div className="chat-header-banner">
        <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="banner-avatar" />
        <div className="banner-details">
          <h2 className="banner-name">{currentPersona.name}</h2>
          <p className="banner-tagline">{currentPersona.tagline}</p>
        </div>
      </div>

      <div className="chat-messages-feed">
        <div className="cai-welcome-card">
          <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="cai-large-avatar" />
          <h3 className="cai-welcome-title">{currentPersona.name}</h3>
          <p className="cai-welcome-tagline">{currentPersona.tagline}</p>
          <div className="cai-greeting-bubble">
            {renderFormattedText(currentPersona.greeting)}
          </div>
        </div>

        {messages.map((msg) => {
          const isAI = msg.sender === 'ai';
          const isCurrentlySpeaking = activeSpeakingId === msg.id && isSpeaking;

          return (
            <div key={msg.id} className={`cai-message-card ${isAI ? 'cai-msg-ai' : 'cai-msg-user'}`}>
              <div className="cai-avatar-column">
                {isAI ? (
                  <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="cai-msg-avatar" />
                ) : (
                  <div className="cai-user-avatar">YOU</div>
                )}
              </div>

              <div className="cai-content-column">
                <div className="cai-msg-header">
                  <span className="cai-msg-sender">{isAI ? currentPersona.name : 'You'}</span>
                  <span className="cai-msg-time">{msg.timestamp}</span>
                  {isAI && <span className="cai-bot-badge">BOT</span>}
                </div>

                <div className="cai-msg-bubble">
                  {renderFormattedText(msg.text)}
                </div>

                {isAI && (
                  <div className="cai-msg-actions">
                    <button 
                      className={`cai-action-btn ${isCurrentlySpeaking ? 'speaking-active' : ''}`}
                      onClick={() => isCurrentlySpeaking ? onStopSpeaking() : onSpeakMessage(msg)}
                      title={isCurrentlySpeaking ? "Stop Speaking" : "Listen to Voice"}
                    >
                      {isCurrentlySpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      <span>{isCurrentlySpeaking ? "Stop" : "Listen"}</span>
                    </button>

                    <button 
                      className="cai-action-btn" 
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy text"
                    >
                      {copiedId === msg.id ? <Check size={15} color="#23a55a" /> : <Copy size={15} />}
                    </button>

                    <div className="cai-swipe-controls">
                      <button className="cai-swipe-btn" title="Previous response">
                        <ChevronLeft size={15} />
                      </button>
                      <span className="cai-swipe-indicator">1 / 1</span>
                      <button className="cai-swipe-btn" title="Next response" onClick={onRegenerateResponse}>
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    <div className="cai-feedback-btns">
                      <button className="cai-mini-btn" title="Good response"><ThumbsUp size={13} /></button>
                      <button className="cai-mini-btn" title="Bad response"><ThumbsDown size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="cai-message-card cai-msg-ai typing-indicator-card">
            <div className="cai-avatar-column">
              <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="cai-msg-avatar spinning-avatar" />
            </div>
            <div className="cai-content-column">
              <div className="cai-msg-header">
                <span className="cai-msg-sender">{currentPersona.name}</span>
                <span className="cai-typing-status">typing...</span>
              </div>
              <div className="cai-dots-loader">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="cai-quick-prompts">
        <button 
          className="prompt-chip"
          onClick={() => setInputText('*waves enthusiastically* What are you working on right now?')}
        >
          <Sparkles size={13} /> *waves enthusiastically* What are you doing?
        </button>
        <button 
          className="prompt-chip"
          onClick={() => setInputText('Can you tell me a secret story about yourself?')}
        >
          <Smile size={13} /> Tell me a secret story!
        </button>
      </div>

      <form onSubmit={handleSubmit} className="cai-input-form">
        <button 
          type="button" 
          className={`mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={() => setIsRecording(!isRecording)}
          title="Voice Speech Input"
        >
          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${currentPersona.name}...`}
          className="cai-text-input"
          disabled={isLoading}
        />

        <button 
          type="submit" 
          disabled={!inputText.trim() || isLoading}
          className="send-btn"
          title="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
