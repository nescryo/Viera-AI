import React, { useState, useRef } from 'react';
import type { UserProfile } from '../../types';
import { UserCheck, Sparkles, Pencil, AlertCircle } from 'lucide-react';

interface SetupOnboardingModalProps {
  initialProfile: Partial<UserProfile> & { name?: string };
  onCompleteSetup: (completedProfile: UserProfile) => void;
}

export const SetupOnboardingModal: React.FC<SetupOnboardingModalProps> = ({
  initialProfile,
  onCompleteSetup
}) => {
  const [username, setUsername] = useState<string>(initialProfile.username || '');
  const [nickname, setNickname] = useState<string>(initialProfile.nickname || initialProfile.name || '');
  const [picture, setPicture] = useState<string>(initialProfile.picture || 'https://api.dicebear.com/7.x/bottts/svg?seed=viera');
  const [gender, setGender] = useState<'male' | 'female' | 'non-binary' | 'unspecified'>(initialProfile.gender || 'unspecified');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg("Image size exceeds 5MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPicture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let cleanHandle = username.trim();
    if (!cleanHandle.startsWith('@')) {
      cleanHandle = `@${cleanHandle}`;
    }

    if (cleanHandle.length < 4) {
      setErrorMsg("Username must be at least 3 characters long.");
      return;
    }

    if (cleanHandle.length > 21) {
      setErrorMsg("Username max 20 characters.");
      return;
    }

    if (!/^@[a-zA-Z0-9_]+$/.test(cleanHandle)) {
      setErrorMsg("Username can only contain letters, numbers, and underscores.");
      return;
    }

    if (!nickname.trim()) {
      setErrorMsg("Display name cannot be empty.");
      return;
    }

    const finalProfile: UserProfile = {
      id: initialProfile.id || Date.now().toString(),
      email: initialProfile.email || '',
      username: cleanHandle,
      nickname: nickname.trim(),
      picture,
      gender,
      bio: initialProfile.bio || 'I love code and 3D anime companions!',
      isSetupComplete: true,
      createdAt: initialProfile.createdAt || Date.now()
    };

    onCompleteSetup(finalProfile);
  };

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <div className="modal-container cai-setup-card glass-panel">
        <div className="setup-header">
          <div className="setup-badge">
            <Sparkles size={16} className="sparkle-glow" />
            <span>Setup Profile</span>
          </div>
          <h2 className="setup-title">Complete Your Setup</h2>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {errorMsg ? (
            <div className="setup-error-banner">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* c.ai Avatar Upload Picker */}
          <div className="cai-avatar-upload-box">
            <div className="cai-avatar-clickable" onClick={handleAvatarClick} title="Upload custom profile picture">
              <img src={picture} alt="Avatar" className="cai-setup-avatar-img" />
              <div className="cai-avatar-edit-badge">
                <Pencil size={14} />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* c.ai Style Input Box 1: Username */}
          <div className="cai-input-group">
            <label className="cai-input-label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="cai-field-input"
              maxLength={20}
              required
            />
            <div className="cai-char-counter">{username.replace(/^@/, '').length}/20</div>
          </div>

          {/* c.ai Style Input Box 2: Display Name */}
          <div className="cai-input-group">
            <label className="cai-input-label">Display Name</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="cai-field-input"
              maxLength={20}
              required
            />
            <div className="cai-char-counter">{nickname.length}/20</div>
          </div>

          {/* c.ai Style Input Box 3: Gender Select */}
          <div className="cai-input-group">
            <label className="cai-input-label">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="cai-field-select"
            >
              <option value="unspecified">Secret / Unspecified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>

          {/* Complete Button */}
          <button type="submit" className="submit-btn cai-submit-btn">
            <UserCheck size={18} />
            <span>Complete Setup</span>
          </button>
        </form>
      </div>
    </div>
  );
};
