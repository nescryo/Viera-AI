import React, { useState } from 'react';
import type { ApiConfig, ApiProvider } from '../../types';
import { X, Save, Server, Cpu, CheckCircle } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ...apiConfig,
      provider,
      lmStudioUrl,
      lmStudioModel
    });
    onClose();
  };

  return (
    <div className="modal-backdrop glass-panel fade-in">
      <div className="modal-container glass-panel settings-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Server className="modal-icon" size={20} />
            <h3>AI Engine & API Settings</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label className="form-label">Select AI Provider</label>
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
                  placeholder="local-model (or model name from LM Studio)"
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
