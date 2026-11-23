/**
 * 가벼운 효과음. 음원 파일 없이 Web Audio 로 합성한다.
 * 기본은 음소거이고, 신분증 화면의 설정에서 켠다.
 */
import { gameStore } from "./store";

type SoundName = "tick" | "place" | "wrong" | "success" | "stamp" | "promote" | "unlock";

let context: AudioContext | null = null;
/** 효과음 전체의 음량(설정의 단계를 따른다) */
let master: GainNode | null = null;

/** 효과음과 음악이 함께 쓰는 오디오 컨텍스트. 사용자의 조작 안에서 불러야 사파리에서 소리가 난다. */
export function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function sfxOut(ctx: AudioContext): AudioNode {
  if (!master || master.context !== ctx) {
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  // 4단계가 예전과 같은 크기다
  master.gain.value = gameStore.getState().settings.soundVolume / 4;
  return master;
}

function tone(
  ctx: AudioContext,
  { freq, start = 0, duration = 0.12, type = "sine", gain = 0.08 }: {
    freq: number;
    start?: number;
    duration?: number;
    type?: OscillatorType;
    gain?: number;
  },
) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(sfxOut(ctx));
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const RECIPES: Record<SoundName, (ctx: AudioContext) => void> = {
  tick: (ctx) => tone(ctx, { freq: 1500, duration: 0.035, type: "square", gain: 0.025 }),
  place: (ctx) => tone(ctx, { freq: 320, duration: 0.09, type: "triangle", gain: 0.07 }),
  wrong: (ctx) => {
    tone(ctx, { freq: 196, duration: 0.16, type: "triangle", gain: 0.07 });
    tone(ctx, { freq: 174, start: 0.09, duration: 0.2, type: "triangle", gain: 0.06 });
  },
  success: (ctx) => {
    tone(ctx, { freq: 523.25, duration: 0.16, gain: 0.07 });
    tone(ctx, { freq: 659.25, start: 0.09, duration: 0.18, gain: 0.07 });
    tone(ctx, { freq: 783.99, start: 0.18, duration: 0.3, gain: 0.07 });
  },
  stamp: (ctx) => {
    tone(ctx, { freq: 90, duration: 0.14, type: "sine", gain: 0.16 });
    tone(ctx, { freq: 60, start: 0.02, duration: 0.18, type: "triangle", gain: 0.1 });
  },
  // 걸쇠가 풀리는 소리: 낮게 덜컥, 이어서 짧게 딸깍
  unlock: (ctx) => {
    tone(ctx, { freq: 150, duration: 0.07, type: "square", gain: 0.06 });
    tone(ctx, { freq: 2100, start: 0.06, duration: 0.03, type: "square", gain: 0.035 });
    tone(ctx, { freq: 110, start: 0.07, duration: 0.12, type: "triangle", gain: 0.08 });
  },
  promote: (ctx) => {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone(ctx, { freq, start: i * 0.11, duration: 0.4, gain: 0.06 }),
    );
  },
};

export function playSound(name: SoundName) {
  if (!gameStore.getState().settings.sound) return;
  try {
    const ctx = ensureContext();
    if (ctx) RECIPES[name](ctx);
  } catch {
    // 소리는 부가 요소다. 실패해도 플레이를 막지 않는다.
  }
}

/** 조작 반응용 짧은 진동 (지원 기기에서만) */
export function haptic(ms = 8) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch {
    // 무시
  }
}
