/**
 * 배경 음악. Web Audio 로 한 곡을 끊김 없이 되풀이하고, 화면이 바뀌면 곡을 겹쳐 넘긴다.
 *  - 기본은 꺼짐이다. 켰을 때만 음원을 내려받아 푼다.
 *  - 모바일 브라우저는 사용자의 조작 뒤에만 소리를 낸다: 첫 조작에서 깨운다(unlock).
 *    터치에서는 손가락이 닿는 순간(pointerdown)이 아니라 떼는 순간(pointerup · touchend)과 그 뒤의 click 이 조작으로 인정된다.
 *  - 화면이 가려지면(다른 탭, 홈 화면) 멈추고, 돌아오면 잇는다.
 */
import { ensureContext } from "../app/sound";
import { TRACKS, type TrackId } from "./tracks";

/** 곡을 겹쳐 넘기는 시간(초) */
const FADE = 1.2;
/** 음량 단계(1~4)의 실제 크기. 음악은 효과음 아래에 깔리도록 낮게 잡았다. */
const LEVEL = [0, 0.16, 0.3, 0.46, 0.64];

interface Playing {
  id: TrackId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

class Music {
  private enabled = false;
  private level = 2;
  private wanted: TrackId | null = null;
  private out: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private playing: Playing | null = null;
  private token = 0;
  /** 실험실에서 다른 후보 음원으로 바꿔 들어 볼 때 쓴다 */
  private urls: Partial<Record<TrackId, string>> = {};

  /** 설정을 따른다: 켜짐 여부와 음량 단계(1~4) */
  configure(enabled: boolean, level: number) {
    this.enabled = enabled;
    this.level = Math.max(1, Math.min(4, Math.round(level)));
    if (this.out) this.out.gain.value = LEVEL[this.level];
    void this.sync();
  }

  /** 지금 화면에 맞는 곡. null 이면 멈춘다. */
  play(id: TrackId | null) {
    this.wanted = id;
    void this.sync();
  }

  /**
   * 사용자의 조작 안에서 부른다(브라우저의 재생 정책). 한 번의 두드림에 여러 번 불려도 된다:
   * 이미 흐르고 있으면 아무 일도 하지 않고, 깨어나는 중에 겹쳐 불리면 마지막 것만 곡을 건다(sync 의 token).
   */
  unlock() {
    if (!this.enabled) return;
    ensureContext();
    void this.sync();
  }

  /** 실험실용: 그 곡의 음원을 다른 파일로 바꾼다 */
  override(id: TrackId, url: string | null) {
    if (url) this.urls[id] = url;
    else delete this.urls[id];
    if (this.playing?.id === id) this.stop(0.2);
    void this.sync();
  }

  get current(): TrackId | null {
    return this.playing?.id ?? null;
  }

  private async sync() {
    const want = this.enabled ? this.wanted : null;
    if (this.playing?.id === want) return;
    const token = ++this.token;
    if (!want) {
      this.stop();
      return;
    }
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      // 깨어나는 중이면 깨어난 뒤에 잇는다. 사용자의 조작 전이라 깨어나지 못하면 다음 조작에서 다시 온다.
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === "running" && token === this.token) void this.sync();
        })
        .catch(() => undefined);
      return;
    }
    const buffer = await this.load(ctx, this.urls[want] ?? TRACKS[want].url);
    if (!buffer || token !== this.token) return;
    this.start(ctx, want, buffer);
  }

  private load(ctx: AudioContext, url: string) {
    let pending = this.buffers.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          // 음악은 부가 요소다. 받지 못해도 게임은 그대로 간다. 다음에 다시 시도한다.
          this.buffers.delete(url);
          return null;
        });
      this.buffers.set(url, pending);
    }
    return pending;
  }

  private start(ctx: AudioContext, id: TrackId, buffer: AudioBuffer) {
    const track = TRACKS[id];
    this.stop();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = track.lead;
    src.loopEnd = Math.min(buffer.duration, track.lead + track.length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(track.gain, ctx.currentTime + FADE);
    if (!this.out || this.out.context !== ctx) {
      this.out = ctx.createGain();
      this.out.connect(ctx.destination);
    }
    this.out.gain.value = LEVEL[this.level];
    src.connect(gain).connect(this.out);
    src.start(0, track.lead);
    this.playing = { id, src, gain };
    this.mark();
  }

  private stop(fade = FADE) {
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    this.mark();
    const ctx = p.gain.context;
    try {
      p.gain.gain.cancelScheduledValues(ctx.currentTime);
      p.gain.gain.setValueAtTime(p.gain.gain.value, ctx.currentTime);
      p.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
      p.src.stop(ctx.currentTime + fade + 0.05);
    } catch {
      // 이미 멈춘 소리다
    }
  }

  /** 지금 흐르는 곡을 문서에 적어 둔다(검수와 자동 테스트가 본다): <html data-music="theme"> */
  private mark() {
    if (typeof document !== "undefined") document.documentElement.dataset.music = this.playing?.id ?? "";
  }

  /** 화면이 가려졌을 때 멈추고, 돌아오면 잇는다 */
  onVisibility(hidden: boolean) {
    const ctx = this.out?.context as AudioContext | undefined;
    if (!ctx) return;
    if (hidden) void ctx.suspend();
    else if (this.enabled) void ctx.resume().then(() => this.sync());
  }
}

export const music = new Music();

/**
 * 소리를 깨울 수 있는 조작들. 브라우저가 "사용자의 조작"으로 인정하는 순간은 입력마다 다르다:
 *  - 마우스: 누르는 순간(pointerdown)
 *  - 터치·펜: 떼는 순간(pointerup · touchend). 닿는 순간(pointerdown)은 조작으로 치지 않는다(스크롤의 시작일 수 있어서).
 *  - 그 뒤에 오는 click, 그리고 키보드(keydown)
 * 한 번의 두드림에 여러 개가 이어서 오지만 unlock 은 겹쳐 불려도 된다.
 */
const UNLOCK_EVENTS = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;

if (typeof window !== "undefined") {
  // 화면의 어느 부품이 이벤트를 삼켜도(stopPropagation) 놓치지 않도록 잡는 단계에서 듣는다
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, () => music.unlock(), { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => music.onVisibility(document.hidden));
}
