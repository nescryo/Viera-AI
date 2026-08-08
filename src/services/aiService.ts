import type { ApiConfig, ChatMessage, Persona, UserProfile } from '../types';

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

export interface ParsedDualOutput {
  emotions: string[];
  actions: string[];
  jaText: string;
  enText: string;
}

export function parseDualOutputResponse(text: string): ParsedDualOutput {
  const { emotions, actions } = parseResponseText(text);

  const jaMatches: string[] = [];
  const jaRegex = /<ja>([\s\S]*?)<\/ja>/gi;
  let match;
  while ((match = jaRegex.exec(text)) !== null) {
    if (match[1].trim()) jaMatches.push(match[1].trim());
  }

  const enMatches: string[] = [];
  const enRegex = /<en>([\s\S]*?)<\/en>/gi;
  while ((match = enRegex.exec(text)) !== null) {
    if (match[1].trim()) enMatches.push(match[1].trim());
  }

  let jaText = jaMatches.join(' ');
  let enText = enMatches.join(' ');

  // Fallback parsing if LLM forgot <ja> or <en> tags
  if (!jaText && !enText) {
    const cleanText = text
      .replace(/\[.*?\]/g, '')
      .replace(/\*.*?\*/g, '')
      .trim();

    jaText = cleanText;
    enText = cleanText;
  } else if (!jaText) {
    jaText = enText;
  } else if (!enText) {
    enText = jaText;
  }

  return { emotions, actions, jaText, enText };
}

/**
 * Formats user's display name and honorific based on profile & gender preferences:
 * - male -> "-san" (e.g. Yokoyama-san)
 * - female -> "-chan" (e.g. Yokoyama-chan)
 * - non-binary / unspecified / fallback -> "-san" (e.g. Yokoyama-san or Trailblazer-san)
 */
export function getUserFormattedName(userProfile?: Partial<UserProfile> | null): string {
  const rawName = userProfile?.nickname?.trim() || userProfile?.username?.replace(/^@/, '').trim();
  const baseName = rawName && rawName.length > 0 ? rawName : 'Trailblazer';
  const gender = userProfile?.gender || 'unspecified';

  if (gender === 'female') {
    return `${baseName}-chan`;
  }
  return `${baseName}-san`;
}

/**
 * Returns persona greeting customized with user's formatted name
 */
export function getPersonaGreeting(persona: Persona, userProfile?: Partial<UserProfile> | null): string {
  const formattedName = getUserFormattedName(userProfile);
  return persona.greeting.replace(/Trailblazer/g, formattedName);
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
  _onError: (err: any) => void,
  userProfile?: UserProfile | null
): Promise<void> {
  const formattedUserName = getUserFormattedName(userProfile);

  const formattedHistory = messages.map(m => {
    if (m.sender === 'user') {
      return { role: 'user', content: m.text };
    }
    if (m.rawText) {
      return { role: 'assistant', content: m.rawText };
    }
    const emotionHeader = m.emotions && m.emotions.length > 0 ? `[${m.emotions[0]}] ` : '';
    const actionHeader = m.actions && m.actions.length > 0 ? `*${m.actions[0]}* ` : '';
    const jaContent = m.originalText || m.text;
    const enContent = m.text.replace(/\[.*?\]/g, '').replace(/\*.*?\*/g, '').trim();
    const reconstructed = `${emotionHeader}${actionHeader}\n<ja>${jaContent}</ja>\n<en>${enContent}</en>`;
    return { role: 'assistant', content: reconstructed };
  });

  const systemMessage = {
    role: 'system',
    content: `${persona.systemPrompt}

USER ADDRESS & HONORIFIC DIRECTIVE:
- The user you are conversing with is named "${formattedUserName}".
- ALWAYS address the user directly as "${formattedUserName}" (e.g., "${formattedUserName}") in all your responses.
- DO NOT call the user "Trailblazer" unless their display name is literally Trailblazer. Always use "${formattedUserName}".

Maintain character at all times. Use asterisks for actions like *smiles* or *gestures*, and use emotion tags like [happy], [blush], [blush-hardly], [teasing], [jealous], [terrified], [pouting], [relaxed], [surprised], [angry], or [sad] when appropriate.`
  };

  if (apiConfig.provider === 'deepseek') {
    const apiKey = apiConfig.deepseekApiKey || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      console.warn("DeepSeek API Key missing. Falling back to dynamic roleplay engine...");
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete, userProfile);
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
          max_tokens: 800,
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
      console.warn("DeepSeek API streaming failed. Falling back to dynamic roleplay engine:", err);
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete, userProfile);
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
          max_tokens: 800,
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
      console.warn("LM Studio connection failed. Falling back to dynamic roleplay engine:", err);
      simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete, userProfile);
      return;
    }
  }

  simulateFallbackStreaming(messages[messages.length - 1]?.text || '', onToken, onComplete, userProfile);
}

/**
 * Simulates smooth typing streaming for built-in roleplay fallback
 */
function simulateFallbackStreaming(
  lastUserText: string,
  onToken: (token: string, fullTextSoFar: string) => void,
  onComplete: (fullText: string, emotions: string[], actions: string[]) => void,
  userProfile?: UserProfile | null
) {
  const responseText = generateMockRoleplayResponse(lastUserText, userProfile);
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

export function generateMockRoleplayResponse(lastUserText: string, userProfile?: Partial<UserProfile> | null): string {
  const userAddress = getUserFormattedName(userProfile);
  const lower = lastUserText.toLowerCase().trim();

  // Extreme Blush / Love Confession -> [blush-hardly]
  if (lower.includes('aku cinta kamu') || lower.includes('i love you') || lower.includes('cinta kamu') || lower.includes('nikah') || lower.includes('marry me')) {
    return `*face turns bright crimson up to her ears, covering her blushing face with trembling hands* [blush-hardly] W-WHAT?! C-Cinta?! ${userAddress}... how could you say something so incredibly embarrassing with a straight face?! My heart is beating so fast it feels like it's going to explode...!`;
  }

  // Jealousy -> [jealous]
  if (lower.includes('cewek lain') || lower.includes('wanita lain') || lower.includes('other girl') || lower.includes('march 7th') || lower.includes('kafka') || lower.includes('sparkle')) {
    return `*pouts deeply with narrowed jealous eyes, turning her head away* [jealous] Hmph! Why are you bringing up other girls in front of me, ${userAddress}? Are they more important to you than me...? I'm not talking to you right now!`;
  }

  // Terrified -> [terrified]
  if (lower.includes('hantu') || lower.includes('takut') || lower.includes('ghost') || lower.includes('scary') || lower.includes('monster') || lower.includes('seram')) {
    return `*hugs herself tightly trembling with terrified wide eyes* [terrified] E-Eeeek! P-Please don't scare me like that, ${userAddress}! Is there really something spooky behind us?! Protect me, please...!`;
  }

  // Teasing -> [teasing]
  if (lower.includes('goda') || lower.includes('tease') || lower.includes('jahil') || lower.includes('lucu') || lower.includes('playful')) {
    return `*smirks playfully with a mischievous wink* [teasing] Ehe~ Are you trying to tease me, ${userAddress}? Or maybe... you just can't take your eyes off me? Who's teasing who now~?`;
  }

  // Pouting -> [pouting]
  if (lower.includes('cemberut') || lower.includes('pout') || lower.includes('sulking') || lower.includes('ngambek')) {
    return `*puffs her cheeks out in an adorable pout* [pouting] I'm not ngambek! I'm just... slightly unamused by your behavior right now, ${userAddress}! You better buy me a sweet cake to make up for it!`;
  }

  // Smug / Teasing
  if (lower.includes('hebat') || lower.includes('pintar') || lower.includes('smart') || lower.includes('pro') || lower.includes('menang')) {
    return `*tilts her chin up playfully with a mischievous smirk* [teasing] Hehe~ Of course! Did you really doubt me, ${userAddress}? You should praise me more~!`;
  }

  // Short questions like "kenapa", "what", "why"
  if (lower === 'kenapa' || lower === 'why' || lower === 'what' || lower === 'apa') {
    return `*menatapmu bingung dengan mata membulat* [surprised] Eh? Kenapa? Ada apa ${userAddress}? Apa ada sesuatu yang menganggumu? Ceritakan padaku!`;
  }

  // Greetings
  if (lower.includes('halo') || lower.includes('hai') || lower.includes('apa kabar') || lower.includes('pagi') || lower.includes('lagi apa')) {
    return `*tersenyum manis dan melambaikan tangan kecilnya* [happy] Selamat pagi, ${userAddress}! Aku senang sekali bisa menyapamu lagi. Hari ini kamu mau jalan-jalan ke Secret Base-ku di Penacony sambil makan kue yang manis?`;
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('morning') || lower.includes('how are you')) {
    return `*smiles warmly with gentle eyes, waving slightly* [happy] Good morning, ${userAddress}! I'm so happy to see you today. Have you had anything sweet to eat yet? Let's spend another wonderful day together!`;
  }

  // Compliments -> standard blush
  if (lower.includes('cantik') || lower.includes('imut') || lower.includes('suka') || lower.includes('love') || lower.includes('cute')) {
    return `*cheeks blush soft rose and looks down timidly* [blush] E-Ehh?! Why are you saying that so suddenly... You make my heart flutter so fast, ${userAddress}...`;
  }

  // Anger
  if (lower.includes('marah') || lower.includes('kesal') || lower.includes('angry')) {
    return `*pouts her lips slightly and glares* [angry] Hmph! You're making me a little upset, ${userAddress}! But... I can never stay truly angry at you...`;
  }

  // Sadness
  if (lower.includes('sedih') || lower.includes('maaf') || lower.includes('sad') || lower.includes('sorry')) {
    return `*looks at you with gentle, worried eyes* [sad] Please don't be sad, ${userAddress}... Whatever happens, I will always stay by your side to protect you!`;
  }

  // Dynamic fallback variations to avoid rigid repetition
  const dynamicFallbacks = [
    `*smiles softly looking at you* [relaxed] Regarding "${lastUserText}", I understand... Being by your side always makes my heart feel so warm and peaceful, ${userAddress}.`,
    `*tilts her head slightly* [surprised] Oh, about "${lastUserText}"? I'm listening to everything you say carefully, ${userAddress}! Is there anything else on your mind?`,
    `*nods gently with a sweet smile* [happy] I always love hearing you talk about "${lastUserText}". Let's spend more quality time together today, ${userAddress}!`
  ];

  const randomIndex = Math.floor(Math.random() * dynamicFallbacks.length);
  return dynamicFallbacks[randomIndex];
}
