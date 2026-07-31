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
      return generateMockRoleplayResponse(persona, messages[messages.length - 1]?.text || '');
    }
  }

  return generateMockRoleplayResponse(persona, messages[messages.length - 1]?.text || '');
}

function generateMockRoleplayResponse(persona: Persona, lastUserText: string): string {
  const lower = lastUserText.toLowerCase();

  if (persona.id === 'march7th') {
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('halo')) {
      return "*snaps a quick photo with her pink camera* [happy] Hey there! I was just organizing my photo album from Belobog. Wanna see the cute photos I took of Dan Heng looking serious?";
    }
    return "*taps her chin thoughtfully* [excited] Ooh, that sounds like an awesome idea! Should we ask Mr. Yang and Himeko if we can visit that planet next? I bet there are super cool scenes to take pictures of!";
  }

  if (persona.id === 'kafka') {
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('halo')) {
      return "*glances up with a gentle, hypnotic smile* [relaxed] Hello, little one. I was wondering when you'd drop by. Everything is going smoothly, just as Elio predicted.";
    }
    return "*smiles softly, adjusting her coat collar* [smirk] How intriguing... You always find ways to surprise me. Tell me more, I'm listening closely.";
  }

  if (persona.id === 'silverwolf') {
    return "*blowing a purple bubblegum bubble, eyes glued to her gaming screen* [bored] Yeah yeah, I hear you. Just give me 10 seconds to finish this boss fight... *clicks button rapid-fire* Boom! Clear! Now, what cheat code do you need today?";
  }

  return "*crosses her arms and pouts* [blush] H-Hmph! Don't think I answered you just because I wanted to talk to you or anything! I'm just fulfilling my duty as your assistant, baka!";
}
