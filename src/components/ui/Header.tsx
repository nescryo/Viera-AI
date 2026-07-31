import React from 'react';
import type { Persona, ApiConfig } from '../../types';
import { Settings, Sparkles, Upload, Circle } from 'lucide-react';

interface HeaderProps {
  currentPersona: Persona;
  onOpenSettings: () => void;
  onOpenModelUploader: () => void;
  apiConfig: ApiConfig;
}

export const Header: React.FC<HeaderProps> = ({
  currentPersona,
  onOpenSettings,
  onOpenModelUploader,
  apiConfig
}) => {
  return (
    <header className="header-container glass-panel">
      {/* Left: App Brand & Active 3D Character Status */}
      <div className="header-left">
        <div className="brand-badge">
          <Sparkles className="icon-sparkle" size={20} />
          <span className="brand-title">VIERA</span>
          <span className="brand-version">3D</span>
        </div>

        <div className="divider-v" />

        <div className="single-persona-chip">
          <div className="avatar-wrapper">
            <img src={currentPersona.avatarUrl} alt={currentPersona.name} className="chip-avatar" />
            <Circle className="status-online" size={10} />
          </div>
          <div className="chip-info">
            <span className="chip-name">{currentPersona.name}</span>
            <span className="chip-category">Active 3D Avatar</span>
          </div>
        </div>
      </div>

      {/* Right: 3D Model Loader & Settings */}
      <div className="header-right">
        <div className={`provider-pill provider-${apiConfig.provider}`}>
          <span className="provider-dot" />
          <span className="provider-name">
            {apiConfig.provider === 'lmstudio' ? 'LM Studio (Local)' : 'Mock Engine'}
          </span>
        </div>

        <button className="icon-btn" onClick={onOpenModelUploader} title="Load Custom 3D Model (.vrm / .glb / .pmx)">
          <Upload size={18} />
          <span className="btn-label-desktop">3D Model</span>
        </button>

        <button className="icon-btn settings-btn" onClick={onOpenSettings} title="Settings & API">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
};
