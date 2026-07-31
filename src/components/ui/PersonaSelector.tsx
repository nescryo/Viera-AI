import React from 'react';
import type { Persona } from '../../types';
import { PERSONA_PRESETS } from '../../data/personas';
import { X, Check, Sparkles } from 'lucide-react';

interface PersonaSelectorProps {
  currentPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  onClose: () => void;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  currentPersona,
  onSelectPersona,
  onClose
}) => {
  return (
    <div className="modal-backdrop glass-panel fade-in">
      <div className="modal-container glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles className="modal-icon" size={20} />
            <h3>Select Roleplay Persona</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="persona-grid">
          {PERSONA_PRESETS.map((p) => {
            const isSelected = p.id === currentPersona.id;
            return (
              <div 
                key={p.id}
                className={`persona-card ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelectPersona(p);
                  onClose();
                }}
              >
                <div className="persona-card-header">
                  <img src={p.avatarUrl} alt={p.name} className="persona-card-avatar" />
                  {isSelected && <Check className="selected-badge" size={18} />}
                </div>

                <h4 className="persona-card-name">{p.name}</h4>
                <span className="persona-card-cat">{p.category}</span>
                <p className="persona-card-tagline">{p.tagline}</p>

                <div className="persona-card-footer">
                  <button className="select-btn">
                    {isSelected ? 'Active Persona' : 'Choose Persona'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
