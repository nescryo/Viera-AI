import type { Persona, ApiConfig } from '../types';

export interface TTSBoundaryEvent {
  name: string;
  charIndex: number;
  charLength?: number;
  word?: string;
}

interface QueueItem {
  text: string;
  persona: Persona;
  apiConfig?: ApiConfig;
  onStart?: () => void;
  onEnd?: () => void;
}

class TTSService {
  private synth: SpeechSynthesis | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private audioQueue: QueueItem[] = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public enqueueClause(
    text: string,
    persona: Persona,
    apiConfig?: ApiConfig,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    const cleanText = text
      .replace(/\*.*?\*/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();

    if (!cleanText) return;

    this.audioQueue.push({ text: cleanText, persona, apiConfig, onStart, onEnd });
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.audioQueue.length === 0) return;
    this.isProcessingQueue = true;

    const item = this.audioQueue.shift();
    if (!item) {
      this.isProcessingQueue = false;
      return;
    }

    const onFinish = () => {
      if (item.onEnd) item.onEnd();
      this.isProcessingQueue = false;
      this.processQueue();
    };

    const ttsProvider = item.apiConfig?.ttsProvider || 'voicevox';
    if (ttsProvider === 'voicevox') {
      await this.speakVoicevox(item.text, item.persona, item.apiConfig, item.onStart, onFinish);
    } else {
      this.speakEdgeNeural(item.text, item.persona, item.onStart, onFinish);
    }
  }

  public speak(
    text: string, 
    persona: Persona, 
    onStart?: () => void, 
    onEnd?: () => void,
    onBoundary?: (event: TTSBoundaryEvent) => void,
    apiConfig?: ApiConfig
  ) {
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

    const ttsProvider = apiConfig?.ttsProvider || 'voicevox';

    if (ttsProvider === 'style-bert-vits2') {
      this.speakStyleBertVits2(cleanText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'voicevox') {
      this.speakVoicevox(cleanText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'vits') {
      this.speakLocalVits(cleanText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'edge') {
      this.speakEdgeNeural(cleanText, persona, onStart, onEnd, onBoundary);
    } else {
      this.speakWebSpeech(cleanText, persona, onStart, onEnd, onBoundary);
    }
  }

  public stop() {
    this.audioQueue = [];
    this.isProcessingQueue = false;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // 1. Edge-TTS Neural Voice Engine with Dynamic Intonation Modulation
  private speakEdgeNeural(
    text: string,
    persona: Persona,
    onStart?: () => void,
    onEnd?: () => void,
    onBoundary?: (event: TTSBoundaryEvent) => void
  ) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    // Insert expressive micro-pauses for natural intonation
    const expressiveText = text
      .replace(/(\!|\?|\.|\,)/g, '$1 ')
      .replace(/\s+/g, ' ');

    // Detect Japanese characters vs English/Indonesian
    const hasJapaneseChars = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);

    const utterance = new SpeechSynthesisUtterance(expressiveText);
    utterance.pitch = hasJapaneseChars ? 1.25 : 1.18; // Sweet anime pitch
    utterance.rate = 0.98;  // Gentle natural conversational speed
    utterance.lang = hasJapaneseChars ? 'ja-JP' : (persona.voice?.lang || 'en-US');

    const voices = this.synth.getVoices();
    if (voices.length > 0) {
      // Prioritize Sweet Female Neural Voices (Ana, Emma, Jenny, Aria, Samantha, Google US English)
      const sweetFemaleVoice = voices.find(v => 
        (v.name.includes('Ana') || v.name.includes('Emma') || v.name.includes('Jenny') || v.name.includes('Aria') || v.name.includes('Samantha') || v.name.includes('Google US English') || v.name.includes('Zira')) &&
        (hasJapaneseChars ? v.lang.startsWith('ja') : v.lang.startsWith('en'))
      ) || voices.find(v => 
        (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.name.includes('Online')) &&
        (hasJapaneseChars ? v.lang.startsWith('ja') : v.lang.startsWith('en'))
      ) || voices.find(v => hasJapaneseChars ? v.lang.startsWith('ja') : v.lang.startsWith('en')) || voices[0];

      if (sweetFemaleVoice) {
        utterance.voice = sweetFemaleVoice;
      }
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (onBoundary) {
        const spokenWord = text.substring(e.charIndex, e.charIndex + (e.charLength || 5));
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

  private async translateToJapanese(text: string): Promise<string> {
    // If text already contains Japanese Kana/Kanji, return as is
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
      return text;
    }

    const lower = text.trim().toLowerCase().replace(/^[,\.\!\?\s]+|[,\.\!\?\s]+$/g, '');

    // Fast Anime Roleplay Phrase Dictionary for authentic intimate voice dubbing
    const animeDict: Record<string, string> = {
      'hello there': 'やあ、こんにちは',
      'hello': 'こんにちは',
      'hi': 'やあ',
      'good morning': 'おはようございます',
      'good evening': 'こんばんは',
      'good night': 'おやすみなさい',
      'how are you feeling today': '今日の気分はいかがですか？',
      'how are you today': '今日は調子どうですか？',
      'how are you': 'お元気ですか？',
      'are you okay': '大丈夫ですか？',
      'are you alright': '大丈夫ですか？',
      'trailblazer': 'トレイルブレイザーさん',
      'thank you': 'ありがとうございます',
      'thank you so much': '本当にありがとうございます',
      'see you later': 'また後でね',
      'don\'t worry': '心配しないでね',
      'what': 'えっ',
      'what-': 'えっ…',
      'wait': '待って',
      'wait-': '待って…'
    };

    if (animeDict[lower]) {
      return animeDict[lower];
    }

    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch (e) {
      console.warn("Auto EN->JA translation failed, using raw text:", e);
    }
    return text;
  }

  public async translateJapaneseToEnglish(text: string): Promise<string> {
    if (!/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
      return text;
    }
    try {
      const cleanJa = text.replace(/\[.*?\]/g, '').replace(/\*.*?\*/g, '').trim();
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanJa)}&langpair=ja|en`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch (e) {
      console.warn("Auto JA->EN subtitle translation failed:", e);
    }
    return text;
  }

  // 2. VOICEVOX Anime Voice Engine Integration (http://localhost:50021)
  private async speakVoicevox(
    text: string,
    persona: Persona,
    apiConfig?: ApiConfig,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    const voicevoxHost = '/voicevox_api';
    const speakerId = apiConfig?.voicevoxSpeakerId ?? 0; // Default to ID 0: Shikikoku Metan (Ama-ama / Sweet & Calm Anime Girl)

    try {
      // Auto translate English text to Japanese for authentic anime dubbing
      const jaText = await this.translateToJapanese(text);

      // Step 1: Create Audio Query
      const queryRes = await fetch(`${voicevoxHost}/audio_query?text=${encodeURIComponent(jaText)}&speaker=${speakerId}`, {
        method: 'POST'
      });

      if (!queryRes.ok) {
        throw new Error(`VOICEVOX audio_query status ${queryRes.status}`);
      }

      const queryJson = await queryRes.json();

      // Dynamic Audio Prosody & Intonation Modulation based on punctuation
      const hasCutoff = text.includes('-') || text.includes('—');
      const hasExclamation = text.includes('!');
      const hasEllipsis = text.includes('...') || text.includes('…');
      const hasQuestion = text.includes('?');

      if (hasCutoff) {
        // Abrupt cut-off (e.g. "what-"): Snappy speed, minimal trailing silence
        queryJson.speedScale = 1.15;
        queryJson.postPhonemeLength = 0.05;
      }

      if (hasExclamation) {
        // Subtle pitch lift (+0.03) preserving calm & sweet anime voice
        queryJson.pitchScale = (queryJson.pitchScale || 0) + 0.03;
        queryJson.intonationScale = (queryJson.intonationScale || 1.0) * 1.05;
      }

      if (hasEllipsis) {
        // Lengthened speech & gentle pause for (...)
        queryJson.speedScale = (queryJson.speedScale || 1.0) * 0.82;
        queryJson.postPhonemeLength = (queryJson.postPhonemeLength || 0.1) + 0.35;
      }

      if (hasQuestion) {
        // Inquiring pitch curve
        queryJson.pitchScale = (queryJson.pitchScale || 0) + 0.08;
      }

      // Step 2: Synthesize Audio Wave
      const synthRes = await fetch(`${voicevoxHost}/synthesis?speaker=${speakerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryJson)
      });

      if (!synthRes.ok) {
        throw new Error(`VOICEVOX synthesis status ${synthRes.status}`);
      }

      const audioBlob = await synthRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        // Fallback to Edge Neural if VOICEVOX local server is offline
        this.speakEdgeNeural(text, persona, onStart, onEnd);
      };

      await audio.play();
    } catch (err) {
      console.warn("VOICEVOX Server offline or CORS blocked, using Edge Neural fallback:", err);
      this.speakEdgeNeural(text, persona, onStart, onEnd);
    }
  }

  // Style-Bert-VITS2 Anime Voice Engine API (http://localhost:5000/voice)
  private async speakStyleBertVits2(
    text: string,
    persona: Persona,
    apiConfig?: ApiConfig,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    const baseUrl = apiConfig?.styleBertUrl || '/style_bert_api/voice';
    const proxyUrl = baseUrl.startsWith('http://localhost:5000') ? baseUrl.replace('http://localhost:5000', '/style_bert_api') : baseUrl;
    
    try {
      // Auto translate English text to Japanese for authentic anime dubbing
      const jaText = await this.translateToJapanese(text);
      const requestUrl = `${proxyUrl}?text=${encodeURIComponent(jaText)}&model_name=Firefly`;

      const response = await fetch(requestUrl);
      if (!response.ok) {
        throw new Error(`Style-Bert-VITS2 API status ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        this.speakEdgeNeural(text, persona, onStart, onEnd);
      };

      await audio.play();
    } catch (err) {
      console.warn("Style-Bert-VITS2 Server offline, falling back to Edge Neural Voice:", err);
      this.speakEdgeNeural(text, persona, onStart, onEnd);
    }
  }

  // 3. Local VITS Anime Voice Server Integration (Sherpa-ONNX / Style-Bert-VITS2)
  private async speakLocalVits(
    text: string,
    persona: Persona,
    apiConfig?: ApiConfig,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    const vitsUrl = apiConfig?.vitsServerUrl || 'http://localhost:5000/tts';

    try {
      const response = await fetch(`${vitsUrl}?text=${encodeURIComponent(text)}&character=${encodeURIComponent(persona.name)}`);
      
      if (!response.ok) {
        throw new Error(`VITS Server returned status ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };

      audio.onended = () => {
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        this.currentAudio = null;
        // Fallback to Edge Neural if VITS local server is offline
        this.speakEdgeNeural(text, persona, onStart, onEnd);
      };

      await audio.play();
    } catch (err) {
      console.warn("Local VITS Server offline, falling back to Edge Neural Voice:", err);
      this.speakEdgeNeural(text, persona, onStart, onEnd);
    }
  }

  // 3. Fallback Web Speech Synthesis
  private speakWebSpeech(
    text: string,
    persona: Persona,
    onStart?: () => void,
    onEnd?: () => void,
    onBoundary?: (event: TTSBoundaryEvent) => void
  ) {
    this.speakEdgeNeural(text, persona, onStart, onEnd, onBoundary);
  }

  public isSpeaking(): boolean {
    const isSynthSpeaking = this.synth ? this.synth.speaking : false;
    const isAudioPlaying = this.currentAudio ? !this.currentAudio.paused : false;
    return isSynthSpeaking || isAudioPlaying;
  }
}

export const ttsService = new TTSService();
