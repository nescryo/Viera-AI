import type { Persona, ApiConfig, VoicevoxSpeaker, VoicevoxStyle } from '../types';

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
  private audioCtx: AudioContext | null = null;
  private originalJaTextCache: Map<string, string> = new Map();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  private currentBufferSource: AudioBufferSourceNode | null = null;

  // Point 4: Web Audio API AudioContext & Acoustic Polish Methods
  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private createImpulseResponse(ctx: AudioContext, duration: number = 0.22, decay: number = 2.2): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const dec = Math.pow(n / length, decay);
      left[i] = (Math.random() * 2 - 1) * dec * 0.12;
      right[i] = (Math.random() * 2 - 1) * dec * 0.12;
    }
    return impulse;
  }

  // Sample-exact RAM playback via AudioBufferSourceNode (Zero latency & Zero initial clipping)
  private async playProcessedArrayBuffer(
    arrayBuffer: ArrayBuffer,
    onStart?: () => void,
    onEnd?: () => void,
    onErrorFallback?: () => void
  ) {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Decode PCM WAV bytes directly in RAM
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Create sample-exact AudioBufferSourceNode
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      this.currentBufferSource = source;

      // 1. Equalizer for warm anime vocal tone (subtle low warmth, soft high cut)
      const lowEq = ctx.createBiquadFilter();
      lowEq.type = 'lowshelf';
      lowEq.frequency.value = 250;
      lowEq.gain.value = 2.2; // Gentle vocal warmth

      const highEq = ctx.createBiquadFilter();
      highEq.type = 'highshelf';
      highEq.frequency.value = 5500;
      highEq.gain.value = -1.8; // Soften harsh digital highs

      // 2. Soft Studio Reverb (Convolver Node)
      const convolver = ctx.createConvolver();
      convolver.buffer = this.createImpulseResponse(ctx, 0.22, 2.2);

      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.10; // 10% subtle studio room reverb blend

      const dryGain = ctx.createGain();
      dryGain.gain.value = 0.95;

      // Audio Graph routing:
      source.connect(lowEq);
      lowEq.connect(highEq);

      // Dry path (main voice)
      highEq.connect(dryGain);
      dryGain.connect(ctx.destination);

      // Wet path (studio acoustic room reverb)
      highEq.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(ctx.destination);

      source.onended = () => {
        this.currentBufferSource = null;
        if (onEnd) onEnd();
      };

      if (onStart) onStart();
      // Schedule playback 50ms in the hardware audio clock to guarantee 100% unmuted DAC startup!
      source.start(ctx.currentTime + 0.05);
    } catch (err) {
      console.warn("Web Audio API decode/play error, using fallback:", err);
      if (onErrorFallback) onErrorFallback();
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

    // Clean action asterisks (*actions*), emotion tags ([emotion]), markdown artifacts, and emojis for speech output
    const cleanText = text
      .replace(/\*.*?\*/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[`#~_>]/g, '')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    let targetText = cleanText;
    // Check if cleanText is English and exists in originalJaTextCache
    if (!/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(cleanText)) {
      const cachedJa = this.originalJaTextCache.get(cleanText.toLowerCase());
      if (cachedJa) {
        targetText = cachedJa;
      }
    }

    const ttsProvider = apiConfig?.ttsProvider || 'voicevox';

    if (ttsProvider === 'style-bert-vits2') {
      this.speakStyleBertVits2(targetText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'voicevox') {
      this.speakVoicevox(targetText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'vits') {
      this.speakLocalVits(targetText, persona, apiConfig, onStart, onEnd);
    } else if (ttsProvider === 'edge') {
      this.speakEdgeNeural(targetText, persona, onStart, onEnd, onBoundary);
    } else {
      this.speakWebSpeech(targetText, persona, onStart, onEnd, onBoundary);
    }
  }

  // Helper method for Point 2: Japanese Sentence Flow Normalization, Clause Breathing Punctuation & Dialogue Brackets
  private normalizeJapaneseSentenceFlow(jaText: string): string {
    let result = jaText.trim();

    // 1. Normalize ASCII punctuation marks to authentic Japanese punctuation
    result = result
      .replace(/,/g, '、')
      .replace(/\./g, '。')
      .replace(/\?/g, '？')
      .replace(/!/g, '！');

    // 2. Convert Western quotes "..." to Japanese dialogue brackets 「...」
    result = result
      .replace(/"([^"]+)"/g, '「$1」')
      .replace(/'([^']+)'/g, '「$1」');

    // 3. Insert natural breathing pauses (Japanese comma 、) after clauses & conjunctions if unpunctuated
    result = result
      .replace(/(ので|から|けど|けれど|のに|だから|そして|それで|ですが|けれども|のですが)(?![、。！？…「」\s])/g, '$1、')
      .replace(/(ね|よ|わ)(?=[A-Z\u3040-\u30ff\u4e00-\u9fff])(?![、。！？…「」\s])/g, '$1、');

    // 4. Ensure non-empty Japanese text ends with proper punctuation for natural pitch cadence
    if (result && !/[。！？…「」]$/.test(result)) {
      result += '。';
    }

    return result;
  }

  public stop() {
    this.audioQueue = [];
    this.isProcessingQueue = false;
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
      } catch (_) {
        // ignore if already stopped
      }
      this.currentBufferSource = null;
    }
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
    let processedText = text.trim();

    // 1. Clean English letter stutter prefixes & normalize clipped Japanese hesitation fillers (e.g. "えっと" -> "えーっとね、")
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(processedText)) {
      processedText = processedText
        .replace(/\b[wW][-–—\s]+(?=待っ|なに|何|やめ|いいえ|お願い|ごめん|バカ|バーカ)/g, 'ま、')
        .replace(/\b([a-zA-Z])[-–—\s]+(?=[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff])/g, 'っ、')
        .replace(/^えっと([…\.\s！]*)$/g, 'えーっとね、')
        .replace(/^あの([…\.\s！]*)$/g, 'あのね、');
      return processedText;
    }

    // 2. Preprocess English stuttering patterns & anime squeals into authentic Japanese Kana
    processedText = processedText
      .replace(/\bh[-–—\s]+hyaa?\b/gi, 'ひゃ、ひゃあぁー')
      .replace(/\bk[-–—\s]+kyaa?\b/gi, 'きゃ、きゃあぁー')
      .replace(/\bu[-–—\s]+uwaa?\b/gi, 'う、うわぁぁー')
      .replace(/\bf[-–—\s]+fuee?\b/gi, 'ふ、ふぇぇー')
      .replace(/\bi[-–—\.\s]+i\b/gi, 'わ、私…')
      .replace(/\by[-–—\.\s]+you\b/gi, 'あ、あんた')
      .replace(/\bm[-–—\.\s]+me\b/gi, 'わ、私')
      .replace(/\bw[-–—\s]+wait\b/gi, 'ま、待って')
      .replace(/\bw[-–—\s]+what\b/gi, 'えっ、な、なに')
      .replace(/\bd[-–—\s]+don'?t\b/gi, 'や、やめて')
      .replace(/\bn[-–—\s]+no\b/gi, 'い、いいえ')
      .replace(/\bp[-–—\s]+please\b/gi, 'お、お願い')
      .replace(/\bs[-–—\s]+sorry\b/gi, 'ご、ごめんなさい')
      .replace(/\bb[-–—\s]+baka\b/gi, 'ば、バーカ')
      .replace(/\bh[-–—\s]+huh\b/gi, 'はっ、はぁ')
      .replace(/\be[-–—\s]+eh\b/gi, 'えっ、えーっ')
      .replace(/\ba[-–—\s]+ah\b/gi, 'あっ、あぁ');

    // If preprocessed text now contains Japanese Kana/Kanji, return immediately!
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(processedText)) {
      return processedText;
    }

    // 3. Normalize single-letter English stutters (e.g. "t- test" -> "test") so translation API doesn't get letter sound artifacts
    const cleanStutterText = processedText.replace(/\b([a-zA-Z])[-–—\s]+([a-zA-Z]{2,})\b/g, '$2');

    const lower = cleanStutterText.toLowerCase().replace(/^[,\.\!\?\s]+|[,\.\!\?\s]+$/g, '');

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
      'h- hyaa': 'ひゃ、ひゃあぁー？！',
      'h-hyaa': 'ひゃ、ひゃあぁー？！',
      'h- hyaa?': 'ひゃ、ひゃあぁー？！',
      'h-hyaa?': 'ひゃ、ひゃあぁー？！',
      'h- hyaa!': 'ひゃ、ひゃあぁー？！',
      'h-hyaa!': 'ひゃ、ひゃあぁー？！',
      'h- hyaa?!': 'ひゃ、ひゃあぁー？！',
      'h-hyaa?!': 'ひゃ、ひゃあぁー？！',
      'hyaa': 'ひゃあぁー！',
      'hyaa?': 'ひゃあぁー？！',
      'hyaa!': 'ひゃあぁー！',
      'hyaa?!': 'ひゃあぁー？！',
      'hya': 'ひゃあぁー！',
      'kyaa': 'きゃあぁー！',
      'kyaa!': 'きゃあぁー！',
      'kyaa?!': 'きゃ、きゃあぁー？！',
      'k-kyaa': 'きゃ、きゃあぁー？！',
      'k-kyaa?': 'きゃ、きゃあぁー？！',
      'k-kyaa!': 'きゃ、きゃあぁー？！',
      'k-kyaa?!': 'きゃ、きゃあぁー？！',
      'uwaa': 'うわぁぁー！',
      'uwaa!': 'うわぁぁー！',
      'uwaa?!': 'う、うわぁぁー？！',
      'fuee': 'ふぇぇー…',
      'fuee...': 'ふぇぇー…',
      'i- i': 'わ、私…',
      'i-i': 'わ、私…',
      'i- i...': 'わ、私…',
      'i-i...': 'わ、私…',
      'i... i...': 'わ、私…',
      'i... i': 'わ、私…',
      'i i': 'わ、私…',
      'etto': 'えーっとね、',
      'etto...': 'えーっとね、',
      'ettoo': 'えーっとね、',
      'ettoo...': 'えーっとね、',
      'eto': 'えーっとね、',
      'eto...': 'えーっとね、',
      'e-etto': 'えーっとね、',
      'ano': 'あのね、',
      'ano...': 'あのね、',
      'anoo': 'あのね、',
      'anoo...': 'あのね、',
      'e- eh': 'えっ、えーっ？',
      'e-eh': 'えっ、えーっ？',
      'e- eh?': 'えっ、えーっ？',
      'e-eh?': 'えっ、えーっ？',
      'eh': 'えー？',
      'eh?': 'えーっ？',
      'huh': 'えっ？',
      'huh?': 'えっ…？',
      'h-huh': 'はっ、はぁ…？',
      'h-huh?': 'はっ、はぁ…？',
      'what': 'えっ',
      'what?': 'えーっ？',
      'what-': 'えっ…',
      'wait': '待って',
      'wait-': '待って…',
      'umm': 'あのー…',
      'umm...': 'あのね…',
      'hm': 'んー…',
      'hmmm': 'ふーむ…',
      'ah': 'あっ',
      'ah!': 'あっ！',
      'oops': 'あっ…'
    };

    if (animeDict[lower]) {
      return animeDict[lower];
    }

    if (this.originalJaTextCache.has(lower)) {
      return this.originalJaTextCache.get(lower)!;
    }

    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanStutterText)}&langpair=en|ja`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        const jaRes = data.responseData.translatedText;
        if (jaRes && !jaRes.includes('MYMEMORY WARNING')) {
          return jaRes;
        }
      }
    } catch (e) {
      console.warn("Auto EN->JA translation failed, using raw text:", e);
    }
    return cleanStutterText;
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
        const rawText = data.responseData.translatedText;
        let enResult = rawText;
        if (typeof DOMParser !== 'undefined') {
          const doc = new DOMParser().parseFromString(rawText, 'text/html');
          enResult = doc.documentElement.textContent || rawText;
        }
        
        // Cache the English translation back to the original Japanese text!
        if (enResult && !enResult.includes('MYMEMORY WARNING')) {
          this.originalJaTextCache.set(enResult.trim().toLowerCase(), text);
          const cleanEn = enResult.replace(/\[.*?\]/g, '').replace(/\*.*?\*/g, '').trim().toLowerCase();
          if (cleanEn) {
            this.originalJaTextCache.set(cleanEn, text);
          }
          return enResult;
        }
      }
    } catch (e) {
      console.warn("Auto JA->EN subtitle translation failed:", e);
    }
    return text;
  }

  // Point 3: Dynamic Emotion Detection & Universal Voicevox Style Switching
  private voicevoxSpeakersCache: VoicevoxSpeaker[] | null = null;

  public async fetchVoicevoxSpeakers(): Promise<VoicevoxSpeaker[]> {
    if (this.voicevoxSpeakersCache) return this.voicevoxSpeakersCache;
    try {
      const res = await fetch('/voicevox_api/speakers');
      if (res.ok) {
        const data: VoicevoxSpeaker[] = await res.json();
        this.voicevoxSpeakersCache = data;
        return data;
      }
    } catch (e) {
      console.warn("Failed to fetch VOICEVOX speakers list:", e);
    }
    return [];
  }

  private detectEmotionFromText(text: string): 'tsundere' | 'sweet' | 'whisper' | 'sad' | 'joy' | 'shy' | 'neutral' {
    const lower = text.toLowerCase();
    
    // Explicit action asterisks or explicit emotion tags
    if (/\*(?:blushes|pouts|angry|tsundere|shouts|yells)\*/i.test(text) || /tsundere|baka|shut up|idiot|h-mph|hmph|don'?t get the wrong idea|marah|cemburu|ばか|バーカ/i.test(lower)) {
      return 'tsundere';
    }
    if (/\*(?:whispers|berbisik|bisik)\*/i.test(text) || /\b(?:whispers|berbisik)\b/i.test(lower)) {
      return 'whisper';
    }
    if (/\*(?:cries|sobs|crying|sad)\*/i.test(text) || /cries|crying|sorry|gomen|sob|sedih|nangis|泣|かなしい/i.test(lower)) {
      return 'sad';
    }
    if (/\*(?:shy|flustered)\*/i.test(text) || /pemalu|malu|shy|flustered|blush/i.test(lower)) {
      return 'shy';
    }
    if (/\*(?:giggles|laughs|smiles|happy)\*/i.test(text) || /giggles|happy|love|sweet|yay|hehe|haha|senang|gembira|sayang|あまあま|甘い/i.test(lower)) {
      return 'sweet';
    }
    if (text.includes('!') || text.includes('！')) {
      return 'joy';
    }
    return 'neutral';
  }

  private resolveEmotionSpeakerStyle(
    baseSpeakerId: number,
    emotion: 'tsundere' | 'sweet' | 'whisper' | 'sad' | 'joy' | 'shy' | 'neutral',
    speakers: VoicevoxSpeaker[]
  ): number {
    if (!speakers || speakers.length === 0) return baseSpeakerId;

    const targetSpeaker = speakers.find(s => s.styles.some(st => st.id === baseSpeakerId));
    if (!targetSpeaker || targetSpeaker.styles.length <= 1) {
      return baseSpeakerId;
    }

    let styleMatch: VoicevoxStyle | undefined;

    if (emotion === 'tsundere') {
      styleMatch = targetSpeaker.styles.find(s => /ツン|怒|ツンデレ/i.test(s.name));
    } else if (emotion === 'sweet' || emotion === 'joy' || emotion === 'shy') {
      // For sweet/joy/shy, prefer base selected style or lively normal style to avoid slow sleepy drawl
      styleMatch = targetSpeaker.styles.find(s => s.id === baseSpeakerId) || targetSpeaker.styles.find(s => /ノーマル|通常/i.test(s.name));
    } else if (emotion === 'whisper') {
      styleMatch = targetSpeaker.styles.find(s => /ささやき|ウィスパー/i.test(s.name));
    } else if (emotion === 'sad') {
      styleMatch = targetSpeaker.styles.find(s => /悲|なみだ|泣/i.test(s.name));
    }

    // Protection: Never pick a creepy whisper style (ヒソヒソ) for non-whisper emotions!
    if (styleMatch && /ヒソヒソ/i.test(styleMatch.name) && emotion !== 'whisper') {
      return baseSpeakerId;
    }

    return styleMatch ? styleMatch.id : baseSpeakerId;
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
    const baseSpeakerId = apiConfig?.voicevoxSpeakerId ?? 0; // Default to ID 0: Shikikoku Metan (Ama-ama / Sweet & Calm Anime Girl)

    try {
      // Auto translate English text to Japanese for authentic anime dubbing
      const jaText = await this.translateToJapanese(text);

      // Protection: If text is still raw English and has no Japanese Kana, fallback to Edge Neural English voice instead of forcing VOICEVOX Katakana accent!
      const isStillEnglish = !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(jaText) && /[a-zA-Z]{3,}/.test(jaText);
      if (isStillEnglish) {
        console.warn("Text is English and could not be translated to Japanese. Using Edge Neural fallback to avoid Katakana accent artifact:", text);
        this.speakEdgeNeural(text, persona, onStart, onEnd);
        return;
      }

      // Apply Point 2: Normalize Japanese sentence flow, breathing punctuation, dialogue brackets & pitch cadence
      const formattedJaText = this.normalizeJapaneseSentenceFlow(jaText);

      // Apply Point 3: Dynamic Emotion Detection & Universal Voicevox Style Switching
      const emotion = this.detectEmotionFromText(text);
      const speakers = await this.fetchVoicevoxSpeakers();
      const activeSpeakerId = this.resolveEmotionSpeakerStyle(baseSpeakerId, emotion, speakers);

      // Step 1: Create Audio Query with active emotion style ID
      const queryRes = await fetch(`${voicevoxHost}/audio_query?text=${encodeURIComponent(formattedJaText)}&speaker=${activeSpeakerId}`, {
        method: 'POST'
      });

      if (!queryRes.ok) {
        throw new Error(`VOICEVOX audio_query status ${queryRes.status}`);
      }

      const queryJson = await queryRes.json();

      // Base prosody & rhythm fine-tuning for natural non-robotic flow
      queryJson.pauseLengthScale = (queryJson.pauseLengthScale ?? 1.0) * 0.88;
      queryJson.intonationScale = (queryJson.intonationScale ?? 1.0) * 1.12;

      // Emotion-driven Prosody Modulation & Fine-tuning (Slower, Smooth, Zero Distortion)
      if (emotion === 'tsundere') {
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.03;
        queryJson.intonationScale = 1.18;
        queryJson.speedScale = 0.94;
      } else if (emotion === 'shy') {
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.03;
        queryJson.intonationScale = 1.15;
        queryJson.speedScale = 0.92;
        queryJson.volumeScale = (queryJson.volumeScale ?? 1.0) * 1.05;
      } else if (emotion === 'sweet' || emotion === 'joy') {
        // Firefly Sweet & Happy (Slower, warm, smooth & crystal clear tempo)
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.02;
        queryJson.intonationScale = 1.15;
        queryJson.speedScale = 0.91; // Slower, relaxed & sweet!
        queryJson.volumeScale = (queryJson.volumeScale ?? 1.0) * 1.05;
      } else if (emotion === 'whisper') {
        queryJson.volumeScale = (queryJson.volumeScale ?? 1.0) * 0.90;
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) - 0.01;
        queryJson.speedScale = 0.88;
        queryJson.postPhonemeLength = (queryJson.postPhonemeLength ?? 0.15) + 0.15;
      } else if (emotion === 'sad') {
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) - 0.03;
        queryJson.speedScale = 0.86;
        queryJson.intonationScale = 1.05;
      } else {
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.02;
        queryJson.speedScale = 0.93; // Slower, smooth tempo for normal voice
      }

      // Check for ultra-short interjections & hesitation fillers (e.g. "えーっとね、", "あのね、", "えっ？", <= 8 chars)
      const isShortInterjection = formattedJaText.length <= 8;
      const hasHesitation = formattedJaText.includes('えーっと') || formattedJaText.includes('あのー') || formattedJaText.includes('あのね') || formattedJaText.includes('んー');

      if (isShortInterjection || hasHesitation) {
        // Ensure browser audio buffer has enough time to initialize & finish playback without clipping short sounds
        queryJson.prePhonemeLength = Math.max(queryJson.prePhonemeLength ?? 0.1, 0.25);
        queryJson.postPhonemeLength = Math.max(queryJson.postPhonemeLength ?? 0.1, 0.40);
        queryJson.speedScale = 0.88; // Relaxed speed for cute, resonant anime hesitation
        queryJson.volumeScale = (queryJson.volumeScale ?? 1.0) * 1.18; // Boost volume so short sounds are crisp and clear
      } else {
        // Enforce a minimum 0.25s (250ms) silent lead-in buffer to prevent initial syllable clipping (e.g. "konnichiwa" -> "nichiwa")
        queryJson.prePhonemeLength = Math.max(queryJson.prePhonemeLength ?? 0.1, 0.25);
        queryJson.postPhonemeLength = Math.max(queryJson.postPhonemeLength ?? 0.1, 0.20);
      }

      // Dynamic Audio Prosody & Intonation Modulation based on punctuation
      const hasCutoff = text.includes('-') || text.includes('—');
      const hasExclamation = text.includes('!') || text.includes('！');
      const hasEllipsis = text.includes('...') || text.includes('…');
      const hasQuestion = text.includes('?') || text.includes('？');

      if (hasCutoff) {
        // Abrupt cut-off (e.g. "what-"): Snappy speed, safe trailing silence (never clip!)
        queryJson.speedScale = 0.98;
        queryJson.postPhonemeLength = Math.max(queryJson.postPhonemeLength ?? 0.1, 0.20);
        queryJson.pauseLengthScale = 0.6;
      }

      if (hasExclamation) {
        // Subtle pitch lift preserving sweet anime voice
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.02;
        queryJson.intonationScale = Math.min(queryJson.intonationScale ?? 1.15, 1.18);
      }

      if (hasEllipsis) {
        // Lengthened speech & gentle pause for (...)
        queryJson.speedScale = 0.88;
        queryJson.postPhonemeLength = (queryJson.postPhonemeLength ?? 0.1) + 0.25;
        queryJson.pauseLengthScale = (queryJson.pauseLengthScale ?? 0.88) * 1.20;
      }

      if (hasQuestion) {
        // Inquiring pitch curve lift
        queryJson.pitchScale = (queryJson.pitchScale ?? 0) + 0.04;
        queryJson.intonationScale = Math.min(queryJson.intonationScale ?? 1.15, 1.18);
      }

      // Hard Safety Caps to guarantee zero audio distortion/corruption!
      queryJson.speedScale = Math.min(queryJson.speedScale ?? 0.92, 0.95);
      queryJson.intonationScale = Math.min(queryJson.intonationScale ?? 1.15, 1.20);

      // Step 2: Synthesize Audio Wave
      const synthRes = await fetch(`${voicevoxHost}/synthesis?speaker=${activeSpeakerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryJson)
      });

      if (!synthRes.ok) {
        throw new Error(`VOICEVOX synthesis status ${synthRes.status}`);
      }

      const arrayBuffer = await synthRes.arrayBuffer();

      // Step 3: Play processed audio via RAM AudioBufferSourceNode with Web Audio API Acoustic Polish (Warm EQ + Studio Reverb)
      await this.playProcessedArrayBuffer(
        arrayBuffer,
        onStart,
        onEnd,
        () => this.speakEdgeNeural(text, persona, onStart, onEnd)
      );
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
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
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
        URL.revokeObjectURL(audioUrl);
        this.currentAudio = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
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
