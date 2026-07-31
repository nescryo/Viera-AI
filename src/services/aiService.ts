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

export async function sendChatMessage(
  messages: ChatMessage[],
  persona: Persona,
  apiConfig: ApiConfig
): Promise<string> {
  const formattedHistory = messages.map(m => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text
  }));

  const systemMessage = {
    role: 'system',
    content: `${persona.systemPrompt}\n\nMaintain character at all times. Use asterisks for actions like *smiles* or *gestures*, and use emotion tags like [happy], [blush], [smirk], [surprised], or [angry] when appropriate.`
  };

  if (apiConfig.provider === 'lmstudio') {
    try {
      const response = await fetch(`${apiConfig.lmStudioUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: apiConfig.lmStudioModel || 'local-model',
          messages: [systemMessage, ...formattedHistory],
          temperature: 0.85,
          max_tokens: 400
        })
      });

      if (!response.ok) {
        throw new Error(`LM Studio returned status ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "*smiles softly* (No response content)";
    } catch (err) {
      console.warn("LM Studio connection failed, falling back to built-in Roleplay Engine:", err);
      return generateMockRoleplayResponse(messages[messages.length - 1]?.text || '');
    }
  }

  return generateMockRoleplayResponse(messages[messages.length - 1]?.text || '');
}

function generateMockRoleplayResponse(lastUserText: string): string {
  const lower = lastUserText.toLowerCase();

  // Indonesian greetings
  if (lower.includes('halo') || lower.includes('hai') || lower.includes('apa kabar') || lower.includes('lagi apa')) {
    return "*tersenyum lembut dan melambaikan tangan kecilnya* [happy] Halo! Aku senang sekali bisa mengobrol denganmu lagi. Hari ini kamu sudah makan kue yang manis belum? Mau jalan-jalan ke Secret Base-ku di Penacony?";
  }

  // English greetings
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('how are you')) {
    return "*smiles warmly with gentle eyes, waving slightly* [happy] Hello Trailblazer! I'm so happy to see you today. Have you had anything sweet to eat yet? Let's spend some peaceful time together!";
  }

  // Indonesian questions
  if (lower.includes('siapa kamu') || lower.includes('kamu siapa') || lower.includes('cerita')) {
    return "*menatapmu dengan tatapan hangat* [relaxed] Aku Firefly... AR-26710 dari Stellaron Hunters. Tapi di depanmu, aku cuma Firefly yang ingin membuat kenangan indah bersama Trailblazer. Ada yang ingin kamu ceritakan padaku?";
  }

  // English general response
  return "*nods gently, holding your hand softly* [blush] I hear you... Thank you for sharing that with me. Being here with you always makes my heart feel so warm and peaceful.";
}
