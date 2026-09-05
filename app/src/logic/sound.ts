/**
 * 効果音。外部音声ファイルを使わず Web Audio API で合成する。
 *
 * 単発のオシレーターを鳴らすだけだと電子音の「ピー」で終わってしまうので、
 * 実際の効果音の作り方に倣って
 *   アタック(ノイズの立ち上がり) + ボディ(ピッチが動く音程) + テール(余韻)
 * の層に分けて重ねている。ピッチグライドとフィルタのスイープが、
 * 同じ合成音でも「動き」を感じさせる主要因になる。
 *
 * ミュート設定は localStorage に永続化する。
 */
const MUTE_STORAGE_KEY = "nomopoly-3d-muted";

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
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
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    master = audioCtx.createGain();
    // 音を重ねるようになったぶん、全体を少し絞って歪みを避ける
    master.gain.value = 0.75;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** ホワイトノイズは使い回す(毎回生成すると重い) */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOptions {
  freq: number;
  /** 終端の周波数。指定するとピッチが滑らかに動く */
  to?: number;
  dur: number;
  type?: OscillatorType;
  delay?: number;
  peak?: number;
  /** 立ち上がりの時間。長くすると柔らかく入る */
  attack?: number;
}

function tone({ freq, to, dur, type = "sine", delay = 0, peak = 0.1, attack = 0.008 }: ToneOptions): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx || !master) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.03);
  } catch {
    // 自動再生制限などで失敗しても無視する
  }
}

interface NoiseOptions {
  dur: number;
  delay?: number;
  peak?: number;
  /** バンドパスの中心周波数 */
  freq?: number;
  /** フィルタのスイープ先 */
  to?: number;
  q?: number;
}

function noise({ dur, delay = 0, peak = 0.08, freq = 1800, to, q = 1 }: NoiseOptions): void {
  if (muted) return;
  const ctx = getContext();
  if (!ctx || !master) return;
  try {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    src.buffer = getNoiseBuffer(ctx);
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, start);
    if (to && to !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(start);
    src.stop(start + dur + 0.03);
  } catch {
    // 同上
  }
}

/* --- サイコロ・移動 --- */

export function playDiceTick(): void {
  noise({ dur: 0.035, freq: 2600, to: 1500, peak: 0.05, q: 1.6 });
  tone({ freq: 240, to: 180, dur: 0.03, type: "square", peak: 0.03 });
}

export function playDiceLand(): void {
  noise({ dur: 0.09, freq: 1500, to: 400, peak: 0.09, q: 0.9 });
  tone({ freq: 180, to: 90, dur: 0.14, type: "sine", peak: 0.1 });
  tone({ freq: 523.25, dur: 0.16, type: "triangle", delay: 0.03, peak: 0.07 });
  tone({ freq: 783.99, dur: 0.18, type: "triangle", delay: 0.08, peak: 0.055 });
}

/** 駒が1マス進むたびの軽いステップ音 */
export function playStep(): void {
  noise({ dur: 0.03, freq: 1900, to: 900, peak: 0.035, q: 1.4 });
  tone({ freq: 520, to: 440, dur: 0.035, type: "triangle", peak: 0.035 });
}

/* --- 取得・建設 --- */

/** 土地の取得。レジのような打鍵音から、明るい3和音へ抜ける */
export function playPurchase(): void {
  noise({ dur: 0.05, freq: 3200, to: 1200, peak: 0.07, q: 1.2 });
  [523.25, 659.25, 783.99].forEach((freq, i) =>
    tone({ freq, dur: 0.22, type: "triangle", delay: i * 0.075, peak: 0.09 }),
  );
  tone({ freq: 1046.5, dur: 0.5, type: "sine", delay: 0.22, peak: 0.07, attack: 0.02 });
}

/** 硬貨がこぼれる響き。取得・収入の余韻に重ねる */
export function playCoins(): void {
  for (let i = 0; i < 5; i += 1) {
    const freq = 1500 + Math.random() * 1400;
    tone({ freq, to: freq * 0.82, dur: 0.16, type: "triangle", delay: 0.04 + i * 0.055, peak: 0.045 });
  }
}

/** 改装。槌の打撃を3回入れてから、完成の上昇音で締める */
export function playBuild(): void {
  [0, 0.13, 0.26].forEach((delay, i) => {
    noise({ dur: 0.07, freq: 900 - i * 120, to: 260, peak: 0.09, q: 0.8 });
    tone({ freq: 150 - i * 12, to: 80, dur: 0.1, type: "square", delay, peak: 0.06 });
    noise({ dur: 0.07, delay, freq: 2200, to: 700, peak: 0.06, q: 1.1 });
  });
  [587.33, 739.99, 987.77].forEach((freq, i) =>
    tone({ freq, dur: 0.3, type: "triangle", delay: 0.4 + i * 0.07, peak: 0.08 }),
  );
}

/** きらめき。完成・獲得の仕上げに散らす */
export function playSparkle(): void {
  [1568, 2093, 2637].forEach((freq, i) =>
    tone({ freq, dur: 0.26, type: "sine", delay: i * 0.06, peak: 0.045, attack: 0.004 }),
  );
}

/* --- カード --- */

export function playCardDraw(): void {
  noise({ dur: 0.18, freq: 600, to: 3000, peak: 0.06, q: 0.7 });
  tone({ freq: 880, to: 1180, dur: 0.14, type: "triangle", peak: 0.07 });
}

/** カードをめくる前の焦らし。間隔を詰めながら音程を上げて緊張を作る */
export function playCardSuspense(): void {
  let at = 0;
  for (let i = 0; i < 7; i += 1) {
    tone({ freq: 480 + i * 78, dur: 0.06, type: "square", delay: at, peak: 0.045 });
    noise({ dur: 0.04, delay: at, freq: 3000, to: 1800, peak: 0.03, q: 2 });
    at += 0.2 - i * 0.021;
  }
}

/** カードがめくれた瞬間のファンファーレ */
export function playCardReveal(): void {
  noise({ dur: 0.12, freq: 800, to: 4000, peak: 0.07, q: 0.6 });
  [659.25, 830.61, 987.77, 1318.51].forEach((freq, i) =>
    tone({ freq, dur: 0.3, type: "triangle", delay: i * 0.06, peak: 0.1 }),
  );
  tone({ freq: 1975.53, dur: 0.5, type: "sine", delay: 0.3, peak: 0.05, attack: 0.02 });
}

/* --- 不利な出来事 --- */

/** 飲み代・税など、支払いが発生したときの重い一撃 */
export function playPenalty(): void {
  noise({ dur: 0.16, freq: 700, to: 140, peak: 0.11, q: 0.7 });
  tone({ freq: 320, to: 90, dur: 0.42, type: "sawtooth", peak: 0.09 });
  tone({ freq: 214, to: 62, dur: 0.5, type: "sawtooth", delay: 0.06, peak: 0.06 });
}

export function playDrinkConfirm(): void {
  tone({ freq: 300, to: 200, dur: 0.22, type: "sawtooth", peak: 0.07 });
  noise({ dur: 0.3, freq: 500, to: 180, peak: 0.05, q: 0.6 });
  tone({ freq: 160, to: 110, dur: 0.34, type: "sine", delay: 0.12, peak: 0.06 });
}

export function playElimination(): void {
  noise({ dur: 0.5, freq: 1200, to: 120, peak: 0.08, q: 0.5 });
  [420, 315, 232, 158].forEach((freq, i) =>
    tone({ freq, to: freq * 0.72, dur: 0.4, type: "sawtooth", delay: i * 0.14, peak: 0.09 }),
  );
}

/* --- 進行 --- */

/** ボタン共通のクリック音。連打されても耳障りにならないよう、ごく短く小さくする */
export function playClick(): void {
  noise({ dur: 0.02, freq: 3000, to: 2000, peak: 0.03, q: 2 });
  tone({ freq: 880, dur: 0.025, type: "sine", peak: 0.03 });
}

/** 手番が始まるときの短い上昇音 */
export function playTurnStart(): void {
  tone({ freq: 587.33, dur: 0.14, type: "sine", peak: 0.07 });
  tone({ freq: 880, dur: 0.18, type: "sine", delay: 0.08, peak: 0.07 });
  noise({ dur: 0.12, freq: 1200, to: 3200, peak: 0.03, q: 0.8 });
}

export function playVictory(): void {
  noise({ dur: 0.2, freq: 900, to: 4500, peak: 0.06, q: 0.6 });
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    tone({ freq, dur: 0.34, type: "triangle", delay: i * 0.11, peak: 0.11 }),
  );
  [1318.51, 1567.98].forEach((freq, i) =>
    tone({ freq, dur: 0.7, type: "sine", delay: 0.46 + i * 0.09, peak: 0.07, attack: 0.02 }),
  );
}
