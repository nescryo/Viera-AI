export type SenderType = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  sender: SenderType;
  characterId: string;
  text: string;
  emotions?: string[];
  actions?: string[];
  timestamp: string;
  swipes?: string[];
  activeSwipeIndex?: number;
  isAudioPlaying?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  greeting: string;
  systemPrompt: string;
  avatarUrl: string;
  vrmModelUrl?: string;
  accentColor: string;
  voice: {
    pitch: number;
    rate: number;
    lang: string;
  };
  category: 'Honkai: Star Rail' | 'Anime & Gaming' | 'Original';
}

export type ApiProvider = 'deepseek' | 'lmstudio' | 'gemini' | 'openrouter' | 'mock';

export type TtsProvider = 'edge' | 'vits' | 'voicevox' | 'style-bert-vits2' | 'webspeech';

export interface ApiConfig {
  provider: ApiProvider;
  lmStudioUrl: string;
  lmStudioModel: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  geminiApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
  ttsProvider?: TtsProvider;
  vitsServerUrl?: string;
  styleBertUrl?: string;
  edgeVoice?: string;
  voicevoxSpeakerId?: number;
}

export interface ExpressionState {
  currentEmotion: string;
  intensity: number;
  isSpeaking: boolean;
}
