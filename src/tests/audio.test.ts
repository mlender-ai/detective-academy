import { afterEach, describe, expect, it, vi } from "vitest";
import { trackFor } from "../audio/director";
import { buildDemoState, defaultSettings, hydrate, hydrateSettings, openExamSheet, startExam } from "../engine/progressEngine";

const NOW = new Date("2026-11-22T03:00:00Z");

describe("소리 설정", () => {
  it("기본은 효과음도 음악도 꺼짐이다", () => {
    expect(defaultSettings()).toEqual({ sound: false, music: false, soundVolume: 4, musicVolume: 2 });
    expect(buildDemoState("first-run", NOW).settings.music).toBe(false);
  });

  it("음악과 음량이 없던 때의 저장을 읽으면 효과음 설정은 그대로이고 나머지는 기본값이다", () => {
    const old = JSON.parse(JSON.stringify(buildDemoState("promoted", NOW)));
    old.settings = { sound: true };
    const restored = hydrate(old);
    expect(restored.settings).toEqual({ sound: true, music: false, soundVolume: 4, musicVolume: 2 });
    expect(restored.rank).toBe("D");
  });

  it("깨진 값은 기본값으로, 범위를 벗어난 음량은 1~4 로 맞춘다", () => {
    expect(hydrateSettings(null)).toEqual(defaultSettings());
    expect(hydrateSettings({ sound: "yes", music: 1, soundVolume: 9, musicVolume: -3 })).toEqual({ sound: false, music: false, soundVolume: 4, musicVolume: 1 });
    expect(hydrateSettings({ music: true, musicVolume: 2.6 }).musicVolume).toBe(3);
  });
});

describe("화면마다 흐르는 곡", () => {
  const game = buildDemoState("promoted", NOW);

  it("복도는 복도의 곡, 입학·연습실·신분증은 테마, 문제 풀이와 사건 수사는 추리의 곡이다", () => {
    expect(trackFor({ name: "home" }, game, false)).toBe("corridor");
    expect(trackFor({ name: "home" }, game, true)).toBe("theme");
    expect(trackFor({ name: "practice" }, game, false)).toBe("theme");
    expect(trackFor({ name: "profile" }, game, false)).toBe("theme");
    expect(trackFor({ name: "daily" }, game, false)).toBe("deduction");
    expect(trackFor({ name: "practice-play", id: "x" }, game, false)).toBe("deduction");
    expect(trackFor({ name: "story", id: "d001" }, game, false)).toBe("deduction");
    expect(trackFor({ name: "daily" }, game, true)).toBe("theme");
  });

  it("제한 시간이 있는 시험은 시험지를 펼쳐 푸는 동안에만 카운트다운이다", () => {
    // C→B 시험은 15분 제한이 있다
    const ready = buildDemoState("ready-b", NOW);
    expect(trackFor({ name: "exam" }, ready, false)).toBe("theme"); // 봉투 앞
    const timed = startExam(ready, NOW);
    expect(timed.exam?.stage).toBe("playing");
    expect(timed.exam?.remainingMs).not.toBeNull();
    expect(trackFor({ name: "exam" }, timed, false)).toBe("countdown");
    // 문제 사이(다음 시험지를 펼치기 전)에는 시계가 멈추고 곡도 테마로 돌아온다
    const between = { ...timed, exam: { ...timed.exam!, stage: "ready" as const } };
    expect(trackFor({ name: "exam" }, between, false)).toBe("theme");
    expect(trackFor({ name: "exam" }, openExamSheet(between, NOW), false)).toBe("countdown");
    // F→D 시험은 제한이 없다: 푸는 동안 추리의 곡
    const open = startExam(buildDemoState("exam-ready", NOW), NOW);
    expect(open.exam?.remainingMs).toBeNull();
    expect(trackFor({ name: "exam" }, open, false)).toBe("deduction");
  });
});

describe("음악 깨우기 (브라우저의 재생 정책)", () => {
  afterEach(() => {
    vi.doUnmock("../app/sound");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /**
   * 조작으로 인정받기 전에는 깨어나지 않는 오디오 컨텍스트를 세우고 음악 모듈을 새로 읽는다.
   * 모듈이 창에 건 리스너를 모아 두었다가, 브라우저가 이벤트를 보내듯 순서대로 부른다.
   */
  async function boot() {
    vi.resetModules();
    const listeners = new Map<string, Array<() => void>>();
    const gesture = { accepted: false };
    const started: number[] = [];
    const param = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
    const ctx = {
      state: "suspended" as "suspended" | "running",
      currentTime: 0,
      destination: {},
      waiting: [] as Array<() => void>,
      resume() {
        if (ctx.state === "running") return Promise.resolve();
        // 조작 전에 부른 resume 은 끝나지 않는다. 조작 안에서 다시 불러야 깨어난다.
        if (!gesture.accepted) return new Promise<void>((resolve) => ctx.waiting.push(resolve));
        ctx.state = "running";
        ctx.waiting.splice(0).forEach((resolve) => resolve());
        return Promise.resolve();
      },
      suspend: () => Promise.resolve(),
      decodeAudioData: () => Promise.resolve({ duration: 120 }),
      createGain: () => ({ gain: { ...param }, context: ctx, connect: (node: unknown) => node }),
      createBufferSource: () => ({ buffer: null, loop: false, loopStart: 0, loopEnd: 0, connect: (node: unknown) => node, start: () => started.push(ctx.currentTime), stop() {} }),
    };
    vi.doMock("../app/sound", () => ({
      ensureContext: () => {
        if (ctx.state === "suspended") void ctx.resume();
        return ctx;
      },
    }));
    const page = { dataset: {} as Record<string, string> };
    vi.stubGlobal("window", { addEventListener: (type: string, fn: () => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]) });
    vi.stubGlobal("document", { addEventListener() {}, documentElement: page, hidden: false });
    vi.stubGlobal("fetch", async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    const { music } = await import("../audio/music");
    const fire = (...types: string[]) => types.forEach((type) => listeners.get(type)?.forEach((fn) => fn()));
    /** 약속들이 다 풀릴 때까지 기다린다(깨우기 → 내려받기 → 풀기 → 재생) */
    const settle = async () => {
      for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
    };
    return { music, listeners, gesture, started, page, fire, settle };
  }

  it("터치는 손가락을 떼는 순간에 깨어난다: 닿는 순간(pointerdown)이 조작으로 인정되지 않아도 pointerup · touchend · click 에서 곡이 걸린다", async () => {
    const { music, listeners, gesture, started, page, fire, settle } = await boot();
    expect([...listeners.keys()]).toEqual(expect.arrayContaining(["pointerdown", "pointerup", "touchend", "click", "keydown"]));
    music.configure(true, 2);
    music.play("theme");
    await settle();
    expect(started).toEqual([]); // 조작 전에는 흐르지 않는다

    fire("pointerdown"); // 손가락이 닿았다: 브라우저는 아직 조작으로 치지 않는다
    await settle();
    expect(started).toEqual([]);

    gesture.accepted = true; // 손가락을 뗐다
    fire("pointerup", "touchend", "click");
    await settle();
    expect(started).toHaveLength(1);
    expect(page.dataset.music).toBe("theme");
  });

  it("한 번의 두드림에 겹쳐 불리고, 흐르는 중에 다시 두드려도 곡은 한 번만 걸린다", async () => {
    const { music, gesture, started, fire, settle } = await boot();
    music.configure(true, 2);
    music.play("corridor");
    gesture.accepted = true;
    // 마우스(누르는 순간부터 조작이다)와 터치의 이벤트가 한꺼번에 와도
    fire("pointerdown", "pointerup", "touchend", "click", "keydown");
    await settle();
    expect(started).toHaveLength(1);
    fire("pointerdown", "pointerup", "touchend", "click");
    await settle();
    expect(started).toHaveLength(1);
    expect(music.current).toBe("corridor");
  });

  it("음악이 꺼져 있으면 두드려도 소리를 깨우지 않는다", async () => {
    const { music, gesture, started, page, fire, settle } = await boot();
    music.configure(false, 2);
    music.play("theme");
    gesture.accepted = true;
    fire("pointerdown", "pointerup", "touchend", "click");
    await settle();
    expect(started).toEqual([]);
    expect(page.dataset.music ?? "").toBe("");
  });
});
