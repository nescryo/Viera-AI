import type { Persona } from '../types';

export interface TTSBoundaryEvent {
  name: string;
  charIndex: number;
  charLength?: number;
  word?: string;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public speak(
    text: string, 
    persona: Persona, 
    onStart?: () => void, 
    onEnd?: () => void,
    onBoundary?: (event: TTSBoundaryEvent) => void
  ) {
    if (!this.synth) return;

    this.stop();

    // Clean action asterisks (*actions*) and emotion tags ([emotion]) for speech output
    const cleanText = text
      .replace(/\*.*?\*/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.pitch = persona.voice?.pitch || 1.18;
    utterance.rate = persona.voice?.rate || 0.98;
    utterance.lang = persona.voice?.lang || 'en-US';

    const voices = this.synth.getVoices();
    if (voices.length > 0) {
      // Find best female English or Japanese voice
      const preferredVoice = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Kyoko')) &&
        (v.lang.startsWith('en') || v.lang.startsWith('ja'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (onBoundary) {
        const spokenWord = cleanText.substring(e.charIndex, e.charIndex + (e.charLength || 5));
        onBoundary({
          name: e.name || 'word',
          charIndex: e.charIndex,
          charLength: e.charLength,
          word: spokenWord
        });
      }
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth && (this.synth.speaking || this.synth.pending)) {
      this.synth.cancel();
    }
  }

  public isSpeaking(): boolean {
    return this.synth ? this.synth.speaking : false;
  }
}

export const ttsService = new TTSService();
