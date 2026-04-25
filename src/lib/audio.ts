"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let foundExplicitMale = false;
let voiceResolved = false;

const MALE_HINTS = [
  "minsu",
  "jihun",
  "jinho",
  "minho",
  "junwoo",
  "siwoo",
  "kyuhyung",
  "yongwon",
  "namjoon",
  "남자",
  "남성",
  "male",
];

function pickKoreanVoice(voices: SpeechSynthesisVoice[]): void {
  const ko = voices.filter((v) => v.lang.toLowerCase().startsWith("ko"));
  for (const v of ko) {
    const n = v.name.toLowerCase();
    if (MALE_HINTS.some((m) => n.includes(m.toLowerCase()))) {
      cachedVoice = v;
      foundExplicitMale = true;
      voiceResolved = true;
      return;
    }
  }
  cachedVoice = ko[0] ?? null;
  voiceResolved = true;
}

function ensureVoiceLoaded(): void {
  if (voiceResolved || typeof window === "undefined" || !window.speechSynthesis)
    return;
  const synth = window.speechSynthesis;
  const initial = synth.getVoices();
  if (initial.length) {
    pickKoreanVoice(initial);
    return;
  }
  const handler = () => {
    pickKoreanVoice(synth.getVoices());
    synth.removeEventListener("voiceschanged", handler);
  };
  synth.addEventListener("voiceschanged", handler);
}

// Must be invoked inside a user gesture handler at least once.
export function primeAudio(): void {
  getCtx();
  ensureVoiceLoaded();
  primeSpeech();
}

function primeSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // Browsers often delay the very first utterance. Warm up with a silent one
  // so subsequent speak() calls are immediate.
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(" ");
    u.lang = "ko-KR";
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function speak(
  text: string,
  opts: { rate?: number; pitch?: number; volume?: number } = {},
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  ensureVoiceLoaded();
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    if (cachedVoice) u.voice = cachedVoice;
    // If the OS only has a female Korean voice, drop pitch to simulate male.
    const pitchBias = foundExplicitMale ? 0 : -0.3;
    u.rate = opts.rate ?? 1.4;
    u.pitch = Math.max(0.1, (opts.pitch ?? 1.0) + pitchBias);
    u.volume = opts.volume ?? 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function beep(freq = 880, durationMs = 120, gain = 0.22): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000 + 0.02);
}
