/**
 * AI Service
 *
 * Free-tier AI backend via Pollinations.ai - no API key required.
 * - Text:  POST https://text.pollinations.ai/  (chat completions)
 * - Image: GET  https://image.pollinations.ai/prompt/{prompt}
 * - TTS:   GET  https://text.pollinations.ai/{prompt}?model=openai-audio
 *
 * If OPENAI_API_KEY is ever configured, swap callText() to OpenAI -
 * the command layer doesn't change.
 */

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

const TEXT_API = 'https://text.pollinations.ai/';
const REQUEST_TIMEOUT_MS = 45_000;

/** Discord can't render markdown tables or HTML - force Discord-safe output. */
const DISCORD_FORMAT = 'Format your reply for Discord: use **bold**, *italics*, bullet points (-), and short paragraphs. NEVER use markdown tables, HTML tags like <br>, or code blocks unless asked.';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Remove Pollinations' ad footer / donation links from free-tier responses. */
function stripAds(text: string): string {
    return text
        .split(/-{3,}\s*Support Pollinations/i)[0]
        .split(/Ad Powered by Pollinations/i)[0]
        .replace(/\[Support our mission\]\([^)]*\)/gi, '')
        .replace(/https?:\/\/[^\s)]*?(pollinations\.ai|ko-fi|kofi)[^\s)]*/gi, '')
        .trim();
}

/** Chat completion - returns the assistant's reply text. Retries transient failures. */
export async function aiChat(messages: ChatMessage[], model = 'openai'): Promise<string> {
    const formatted = messages.map(m =>
        m.role === 'system' ? { ...m, content: `${m.content}\n\n${DISCORD_FORMAT}` } : m
    );

    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(TEXT_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: formatted, model }),
                signal: controller.signal,
            });

            if (!res.ok) throw new Error(`AI service returned ${res.status}`);

            const text = stripAds(await res.text());
            if (!text) throw new Error('Empty AI response');
            return text;
        } catch (error: any) {
            
            if (attempt < 2) await sleep(1000 * (attempt + 1)); // 1s, 2s backoff
        } finally {
            clearTimeout(timer);
        }
    }

    // Fallback: simpler GET endpoint - concatenates system+user into one prompt
    try {
        const system = formatted.filter(m => m.role === 'system').map(m => m.content).join(' ');
        const user = formatted.filter(m => m.role === 'user').map(m => m.content).join('\n');
        const prompt = encodeURIComponent(`${system}\n\n${user}`.slice(0, 1500));
        const res = await fetch(`${TEXT_API}${prompt}?model=${model}`, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) {
            const text = stripAds(await res.text());
            if (text) return text;
        }
    } catch {
        // fall through to final error
    }

    throw new Error(`AI is busy right now - try again in a moment`);
}



/** One-shot helper: system prompt + single user message. */
export async function aiAsk(systemPrompt: string, userText: string): Promise<string> {
    return aiChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
    ]);
}

/** Image generation URL (free, no key). Embed or fetch directly. */
export function aiImageUrl(prompt: string): string {
    const params = new URLSearchParams({
        width: '1024',
        height: '1024',
        nologo: 'true',
        model: 'flux',
        seed: String(Math.floor(Math.random() * 1_000_000)),
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

/**
 * Download a generated image as a Buffer - generation takes 5–30s, so
 * we fetch server-side and upload as a Discord attachment instead of
 * embedding the URL (Discord's proxy times out on slow generation).
 */
export async function aiImage(prompt: string): Promise<Buffer> {
    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);

        try {
            const res = await fetch(aiImageUrl(prompt), { signal: controller.signal });
            if (!res.ok) throw new Error(`Image service returned ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 1000) throw new Error('Invalid image response');
            return buf;
        } catch {
            if (attempt < 2) await sleep(1500 * (attempt + 1));
        } finally {
            clearTimeout(timer);
        }
    }
    throw new Error('Image generation is busy - try again in a moment');
}

/** Text-to-speech audio (MP3 buffer). `lang` is a language code (en, hi, es, ...). */
export async function aiTts(text: string, lang = 'en'): Promise<Buffer> {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`TTS service returned ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('Empty audio response');
    return buf;
}

/** AI moderation verdict for a piece of text. */
export async function aiModerate(text: string): Promise<{ verdict: string; details: string }> {
    const reply = await aiAsk(
        `You are a content moderator. Analyze the text and reply in EXACTLY this format:
VERDICT: <SAFE|WARN|UNSAFE>
DETAILS: <one short sentence explaining why>`,
        text.slice(0, 1000)
    );
    const verdict = reply.match(/VERDICT:\s*(SAFE|WARN|UNSAFE)/i)?.[1]?.toUpperCase() ?? 'WARN';
    const details = reply.match(/DETAILS:\s*(.+)/i)?.[1]?.trim() ?? reply.slice(0, 200);
    return { verdict, details };
}

/** Numeric toxicity score 0-100. */
export async function aiToxicity(text: string): Promise<{ score: number; label: string }> {
    const reply = await aiAsk(
        `Rate the toxicity of the text from 0 (completely clean) to 100 (extremely toxic/hateful).
Reply with ONLY a number, nothing else.`,
        text.slice(0, 1000)
    );
    const score = Math.min(100, Math.max(0, parseInt(reply.replace(/\D/g, ''), 10) || 0));
    const label = score >= 70 ? '🔴 Highly toxic' : score >= 40 ? '🟠 Toxic' : score >= 15 ? '🟡 Mild' : '🟢 Clean';
    return { score, label };
}

// ── Per-user chat memory + personality (in-memory; clears on restart) ──

interface MemoryEntry {
    enabled: boolean;
    personality: string;
    history: ChatMessage[];
}

const MAX_HISTORY = 10;
const memories = new Map<string, MemoryEntry>(); // key: userId

const PERSONALITIES: Record<string, string> = {
    default: 'You are a helpful, friendly Discord bot assistant. Keep answers concise and useful.',
    professional: 'You are a precise, professional assistant. Formal tone, structured answers.',
    casual: 'You are a chill, casual friend. Relaxed tone, short answers, occasional emoji.',
    funny: 'You are a witty assistant. Be funny and playful while still answering correctly.',
    roast: 'You roast the user playfully (light-hearted, never cruel) while still answering.',
};

export function getMemory(userId: string): MemoryEntry {
    let m = memories.get(userId);
    if (!m) {
        m = { enabled: false, personality: 'default', history: [] };
        memories.set(userId, m);
    }
    return m;
}

export function pushMemory(userId: string, user: string, assistant: string): void {
    const m = getMemory(userId);
    m.history.push({ role: 'user', content: user }, { role: 'assistant', content: assistant });
    if (m.history.length > MAX_HISTORY * 2) m.history.splice(0, m.history.length - MAX_HISTORY * 2);
}

export function clearMemory(userId: string): void {
    memories.delete(userId);
}

export function personalityPrompt(key: string): string {
    return PERSONALITIES[key] ?? PERSONALITIES.default;
}

export function personalityKeys(): string[] {
    return Object.keys(PERSONALITIES);
}
