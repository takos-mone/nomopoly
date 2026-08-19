/**
 * 効果音。外部音声ファイルを使わず Web Audio API のオシレーターで合成する。
 * ミュート設定は localStorage に永続化する。
 */
const MUTE_STORAGE_KEY = "nomopoly-muted";

let audioCtx: AudioContext | null = null;
let muted = readStoredMute();

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // localStorageが使えない環境では無視
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType, delay: number, peak: number): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  } catch {
    // 自動再生制限などで失敗しても無視する
  }
}

export function playDiceTick(): void {
  playTone(220, 0.03, "square", 0, 0.04);
}

export function playDiceLand(): void {
  playTone(440, 0.15, "triangle", 0, 0.12);
  playTone(660, 0.15, "triangle", 0.05, 0.08);
}

export function playPurchase(): void {
  playTone(523.25, 0.12, "sine", 0, 0.12);
  playTone(659.25, 0.12, "sine", 0.08, 0.12);
  playTone(783.99, 0.18, "sine", 0.16, 0.12);
}

export function playDrinkConfirm(): void {
  playTone(320, 0.2, "sawtooth", 0, 0.08);
  playTone(220, 0.25, "sawtooth", 0.1, 0.06);
}

export function playCardDraw(): void {
  playTone(880, 0.1, "triangle", 0, 0.1);
  playTone(1046.5, 0.12, "triangle", 0.06, 0.1);
}

export function playElimination(): void {
  playTone(400, 0.3, "sawtooth", 0, 0.1);
  playTone(300, 0.3, "sawtooth", 0.15, 0.1);
  playTone(200, 0.4, "sawtooth", 0.3, 0.1);
}

export function playVictory(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => playTone(freq, 0.25, "triangle", i * 0.12, 0.12));
}
