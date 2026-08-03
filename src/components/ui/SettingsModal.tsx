import React, { useState } from 'react';
import type { ApiConfig, ApiProvider, TtsProvider } from '../../types';
import { X, Save, Server, Cpu, CheckCircle, Volume2, Mic, Radio } from 'lucide-react';

interface SettingsModalProps {
  apiConfig: ApiConfig;
  onSaveConfig: (newConfig: ApiConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  apiConfig,
  onSaveConfig,
  onClose
}) => {
  const [provider, setProvider] = useState<ApiProvider>(apiConfig.provider);
  const [lmStudioUrl, setLmStudioUrl] = useState(apiConfig.lmStudioUrl);
  const [lmStudioModel, setLmStudioModel] = useState(apiConfig.lmStudioModel);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(apiConfig.ttsProvider || 'voicevox');
  const [vitsServerUrl, setVitsServerUrl] = useState(apiConfig.vitsServerUrl || 'http://localhost:5000/tts');

  const [voicevoxSpeakerId, setVoicevoxSpeakerId] = useState<number>(apiConfig.voicevoxSpeakerId ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...apiConfig,
      provider,
      lmStudioUrl,
      lmStudioModel,
      ttsProvider,
      vitsServerUrl,
      voicevoxSpeakerId
    });
    onClose();
  };

  return (
    <div className="modal-backdrop glass-panel fade-in">
      <div className="modal-container glass-panel settings-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Server className="modal-icon" size={20} />
            <h3>AI & TTS Voice Settings</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label className="form-label">1. Select AI Text Provider</label>
            <div className="provider-selector-grid">
              <button
                type="button"
                className={`provider-card ${provider === 'lmstudio' ? 'active' : ''}`}
                onClick={() => setProvider('lmstudio')}
              >
                <Cpu size={24} />
                <div className="provider-card-info">
                  <span className="p-title">LM Studio (Local)</span>
                  <span className="p-desc">Free • Offline • localhost:1234</span>
                </div>
                {provider === 'lmstudio' && <CheckCircle size={18} className="p-check" />}
              </button>

              <button
                type="button"
                className={`provider-card ${provider === 'mock' ? 'active' : ''}`}
                onClick={() => setProvider('mock')}
              >
                <Server size={24} />
                <div className="provider-card-info">
                  <span className="p-title">Demo Roleplay Engine</span>
                  <span className="p-desc">Instant offline mock responses</span>
                </div>
                {provider === 'mock' && <CheckCircle size={18} className="p-check" />}
              </button>
            </div>
          </div>

          {provider === 'lmstudio' && (
            <div className="provider-details-box fade-in">
              <div className="form-group">
                <label className="form-label">LM Studio Server Base URL</label>
                <input
                  type="text"
                  value={lmStudioUrl}
                  onChange={(e) => setLmStudioUrl(e.target.value)}
                  placeholder="http://localhost:1234/v1"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Model Name / Identifier</label>
                <input
                  type="text"
                  value={lmStudioModel}
                  onChange={(e) => setLmStudioModel(e.target.value)}
                  placeholder="local-model"
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginTop: '1.2rem' }}>
            <label className="form-label">2. Select TTS Voice Engine</label>
            <div className="provider-selector-grid">
              <button
                type="button"
                className={`provider-card ${ttsProvider === 'voicevox' ? 'active' : ''}`}
                onClick={() => setTtsProvider('voicevox')}
              >
                <Radio size={24} />
                <div className="provider-card-info">
                  <span className="p-title">VOICEVOX Anime Voice</span>
                  <span className="p-desc">Local Server • http://localhost:50021</span>
                </div>
                {ttsProvider === 'voicevox' && <CheckCircle size={18} className="p-check" />}
              </button>

              <button
                type="button"
                className={`provider-card ${ttsProvider === 'edge' ? 'active' : ''}`}
                onClick={() => setTtsProvider('edge')}
              >
                <Volume2 size={24} />
                <div className="provider-card-info">
                  <span className="p-title">Edge-TTS Neural Voice</span>
                  <span className="p-desc">100% Free • Zero-Delay (under 0.2s)</span>
                </div>
                {ttsProvider === 'edge' && <CheckCircle size={18} className="p-check" />}
              </button>

              <button
                type="button"
                className={`provider-card ${ttsProvider === 'vits' ? 'active' : ''}`}
                onClick={() => setTtsProvider('vits')}
              >
                <Mic size={24} />
                <div className="provider-card-info">
                  <span className="p-title">Local Custom VITS Bridge</span>
                  <span className="p-desc">Local Model • http://localhost:5000/tts</span>
                </div>
                {ttsProvider === 'vits' && <CheckCircle size={18} className="p-check" />}
              </button>
            </div>
          </div>

          {ttsProvider === 'voicevox' && (
            <div className="provider-details-box fade-in">
              <div className="form-group">
                <label className="form-label">Select VOICEVOX Anime Voice Character</label>
                <select
                  value={voicevoxSpeakerId}
                  onChange={(e) => setVoicevoxSpeakerId(Number(e.target.value))}
                  className="form-input"
                >
                  <option value={0}>🌸 四国めたん - Shikikoku Metan (Ama-ama / Sweet & Calm Anime Girl)</option>
                  <option value={2}>✨ 四国めたん - Shikikoku Metan (Normal Anime Girl)</option>
                  <option value={36}>🌙 四国めたん - Shikikoku Metan (Whisper / Soft)</option>
                  <option value={10}>🎀 雨晴はう - Amehare Hau (Soft Gentle Nurse)</option>
                  <option value={14}>💕 冥鳴ひまり - Meimei Himari (Cute Girl)</option>
                  <option value={9}>📻 波音リツ - Namine Ritsu (Calm Female)</option>
                  <option value={3}>⚡ ずんだもん - Zundamon (Energetic)</option>
                </select>
              </div>
            </div>
          )}

          {ttsProvider === 'vits' && (
            <div className="provider-details-box fade-in">
              <div className="form-group">
                <label className="form-label">Local VITS Voice Server URL</label>
                <input
                  type="text"
                  value={vitsServerUrl}
                  onChange={(e) => setVitsServerUrl(e.target.value)}
                  placeholder="http://localhost:5000/tts"
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save">
              <Save size={16} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
