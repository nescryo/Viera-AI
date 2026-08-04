import type { ApiConfig, ChatMessage, Persona } from '../types';

export function parseResponseText(text: string) {
  const emotionRegex = /\[(.*?)\]/g;
  const emotions: string[] = [];
  let match;
  while ((match = emotionRegex.exec(text)) !== null) {
    emotions.push(match[1].toLowerCase());
  }

  const actionRegex = /\*(.*?)\*/g;
  const actions: string[] = [];
  while ((match = actionRegex.exec(text)) !== null) {
    actions.push(match[1]);
  }

  return { emotions, actions };
}

/**
 * Checks if local LM Studio API endpoint is online and responding
 */
export async function checkLmStudioConnection(lmStudioUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${lmStudioUrl}/models`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper to process OpenAI-compatible SSE readable stream
 */
export async function readSSEResponseStream(
  response: Response,
  onToken: (token: string, fullTextSoFar: string) => void
): Promise<string> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.substring(6));
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            fullText += content;
            onToken(content, fullText);
          }
        } catch {
          // Ignore partial JSON parse errors
        }
      }
    }
  }

  if (buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
    try {
      const json = JSON.parse(buffer.trim().substring(6));
      const content = json.choices?.[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        onToken(content, fullText);
      }
    } catch {
      // Ignore
    }
  }

  return fullText;
}

/**
 * Sends chat message with real-time SSE token streaming support for LM Studio / OpenAI endpoints
 */
export async function sendStreamingChatMessage(
  messages: ChatMessage[],
  persona: Persona,
  apiConfig: ApiConfig,
  onToken: (token: string, fullTextSoFar: string) => void,
  onComplete: (fullText: string, emotions: string[], actions: string[]) => void,
  onError: (err: any) => void
): Promise<void> {
  const formattedHistory = messages.map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text
  }));

  const systemMessage = {
    role: 'system',
    content: `${persona.systemPrompt}\n\nMaintain character at all times. Use asterisks for actions like *smiles* or *gestures*, and use emotion tags like [happy], [blush], [relaxed], [surprised], [angry], [sad], or [neutral] when appropriate.`
  };

  if (apiConfig.provider === 'deepseek') {
    const apiKey = apiConfig.deepseekApiKey || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      const errMsg = "DeepSeek API Key belum diisi! Silakan masukkan di Settings atau simpan di file .env (VITE_DEEPSEEK_API_KEY).";
      console.error(errMsg);
      onError(new Error(errMsg));
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: apiConfig.deepseekModel || 'deepseek-chat',
          messages: [systemMessage, ...formattedHistory],
          temperature: 0.8,
          max_tokens: 300,
          stream: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errText = '';
        try {
          const errJson = await response.json();
          errText = errJson?.error?.message || response.statusText;
        } catch {
          errText = `HTTP status ${response.status}`;
        }
        throw new Error(`DeepSeek API error: ${errText}`);
      }

      const fullText = await readSSEResponseStream(response, onToken);
      const { emotions, actions } = parseResponseText(fullText);
      onComplete(fullText, emotions, actions);
      return;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("DeepSeek API streaming failed:", err);
      onError(err);
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete);
      return;
    }
  }

  if (apiConfig.provider === 'lmstudio') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${apiConfig.lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: apiConfig.lmStudioModel || 'local-model',
          messages: [systemMessage, ...formattedHistory],
          temperature: 0.8,
          max_tokens: 250,
          stream: true
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`LM Studio returned status ${response.status}`);
      }

      const fullText = await readSSEResponseStream(response, onToken);
      const { emotions, actions } = parseResponseText(fullText);
      onComplete(fullText, emotions, actions);
      return;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("LM Studio connection failed (server offline or port 1234 not listening). Falling back to dynamic roleplay engine:", err);
      onError(err);
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete);
      return;
    }
  }

  simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete);
}

/**
 * Simulates smooth typing streaming for built-in roleplay fallback
 */
function simulateFallbackStreaming(
  lastUserText: string,
  onToken: (token: string, fullTextSoFar: string) => void,
  onComplete: (fullText: string, emotions: string[], actions: string[]) => void
) {
  const responseText = generateMockRoleplayResponse(lastUserText);
  let currentPos = 0;
  let accumulated = '';

  const interval = setInterval(() => {
    if (currentPos < responseText.length) {
      const chunkSize = Math.min(3, responseText.length - currentPos);
      const chunk = responseText.substring(currentPos, currentPos + chunkSize);
      accumulated += chunk;
      currentPos += chunkSize;
      onToken(chunk, accumulated);
    } else {
      clearInterval(interval);
      const { emotions, actions } = parseResponseText(responseText);
      onComplete(responseText, emotions, actions);
    }
  }, 25);
}

export function generateMockRoleplayResponse(lastUserText: string): string {
  const lower = lastUserText.toLowerCase().trim();

  // Short questions like "kenapa", "what", "why"
  if (lower === 'kenapa' || lower === 'why' || lower === 'what' || lower === 'apa') {
    return "*menatapmu bingung dengan mata membulat* [surprised] Eh? Kenapa? Ada apa Trailblazer? Apa ada sesuatu yang menganggumu? Ceritakan padaku!";
  }

  // Greetings
  if (lower.includes('halo') || lower.includes('hai') || lower.includes('apa kabar') || lower.includes('pagi') || lower.includes('lagi apa')) {
    return "*tersenyum manis dan melambaikan tangan kecilnya* [happy] Selamat pagi, Trailblazer! Aku senang sekali bisa menyapamu lagi. Hari ini kamu mau jalan-jalan ke Secret Base-ku di Penacony sambil makan kue yang manis?";
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('morning') || lower.includes('how are you')) {
    return "*smiles warmly with gentle eyes, waving slightly* [happy] Good morning, Trailblazer! I'm so happy to see you today. Have you had anything sweet to eat yet? Let's spend another wonderful day together!";
  }

  // Compliments
  if (lower.includes('cantik') || lower.includes('imut') || lower.includes('suka') || lower.includes('love') || lower.includes('cute')) {
    return "*cheeks blush soft rose and looks down timidly* [blush] E-Ehh?! Why are you saying that so suddenly... You make my heart flutter so fast, Trailblazer...";
  }

  // Anger
  if (lower.includes('marah') || lower.includes('kesal') || lower.includes('angry')) {
    return "*pouts her lips slightly and glares* [angry] Hmph! You're making me a little upset, you know! But... I can never stay truly angry at you...";
  }

  // Sadness
  if (lower.includes('sedih') || lower.includes('maaf') || lower.includes('sad') || lower.includes('sorry')) {
    return "*looks at you with gentle, worried eyes* [sad] Please don't be sad... Whatever happens, I will always stay by your side to protect you!";
  }

  // Dynamic fallback variations to avoid rigid repetition
  const dynamicFallbacks = [
    `*smiles softly looking at you* [relaxed] Regarding "${lastUserText}", I understand... Being by your side always makes my heart feel so warm and peaceful, Trailblazer.`,
    `*tilts her head slightly* [surprised] Oh, about "${lastUserText}"? I'm listening to everything you say carefully, Trailblazer! Is there anything else on your mind?`,
    `*nods gently with a sweet smile* [happy] I always love hearing you talk about "${lastUserText}". Let's spend more quality time together today!`
  ];

  const randomIndex = Math.floor(Math.random() * dynamicFallbacks.length);
  return dynamicFallbacks[randomIndex];
}
