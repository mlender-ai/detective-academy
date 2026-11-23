// OST 비교 페이지. 후보 음원을 게임과 같은 방식(Web Audio 의 구간 되풀이)으로 들려주고, 음악을 켠 게임을 옆에 띄운다.
import { buildDemoState } from "../../src/engine/progressEngine";

interface Row {
  id: string; track: string; title: string; variant: string; task: string; cover_strength: number | null; seed: number; caption: string; bpm: number; key: string;
  gen_seconds: number; audio_seconds: number; realtime_x: number; mlx_peak_gb: number | null; loop_seconds: number; lead_seconds: number; lufs: number; lra: number;
  seam_mismatch: number; m4a_bytes: number; melody_match: number | null; melody_chance: number | null; file: string; seam: string;
}

const rows: Row[] = await (await fetch("./ost.json")).json();
const chosen: Record<string, string> = await (await fetch("./chosen.json")).json().catch(() => ({}));
const LEVEL = [0, 0.16, 0.3, 0.46, 0.64];
const WHERE: Record<string, string> = { theme: "입학 · 연습실 · 신분증 (복도 곡이 없을 때는 복도도)", corridor: "학원 복도", deduction: "문제 풀이 · 사건 수사", countdown: "제한 시간이 있는 승급 시험" };
const VARIANT: Record<string, string> = { "cover-b": "모티프 편곡 · 강도 0.85", "cover-a": "모티프 편곡 · 강도 0.6", text: "글만으로 생성 (모티프 없음)" };

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let playing: { src: AudioBufferSourceNode; id: string } | null = null;
let level = 2;
const buffers = new Map<string, Promise<AudioBuffer>>();
const now = document.getElementById("now")!;

function stop() {
  if (playing) {
    try {
      playing.src.stop();
    } catch {}
    playing = null;
  }
  now.textContent = "멈춰 있음";
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-play]")) b.setAttribute("aria-pressed", "false");
}

async function play(row: Row, fromSeam: boolean, button: HTMLButtonElement) {
  ctx ??= new AudioContext();
  await ctx.resume();
  if (!out) {
    out = ctx.createGain();
    out.connect(ctx.destination);
  }
  out.gain.value = LEVEL[level];
  let pending = buffers.get(row.file);
  if (!pending) {
    pending = fetch(`./${row.file}`).then((r) => r.arrayBuffer()).then((d) => ctx!.decodeAudioData(d));
    buffers.set(row.file, pending);
  }
  now.textContent = `${row.title} · ${VARIANT[row.variant] ?? row.variant} 불러오는 중`;
  const buffer = await pending;
  stop();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.loopStart = row.lead_seconds;
  src.loopEnd = Math.min(buffer.duration, row.lead_seconds + row.loop_seconds);
  src.connect(out);
  src.start(0, fromSeam ? row.lead_seconds + row.loop_seconds - 4 : row.lead_seconds);
  playing = { src, id: row.id };
  button.setAttribute("aria-pressed", "true");
  now.textContent = `▶ ${row.title} · ${VARIANT[row.variant] ?? row.variant}${fromSeam ? " (4초 뒤 이음매)" : ""}`;
}

document.getElementById("stop")!.addEventListener("click", stop);
const levelBox = document.getElementById("level")!;
levelBox.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  level = Number(b.dataset.v);
  for (const other of levelBox.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
  if (out) out.gain.value = LEVEL[level];
});

const tracksBox = document.getElementById("tracks")!;
const order = ["theme", "corridor", "deduction", "countdown"];
const kb = (n: number) => `${Math.round(n / 1024)}KB`;
for (const track of order) {
  const list = rows.filter((r) => r.track === track).sort((a, b) => (b.melody_match ?? 0) - (a.melody_match ?? 0));
  if (!list.length) continue;
  const h = document.createElement("h3");
  h.textContent = list[0].title;
  const sub = document.createElement("p");
  sub.className = "note";
  sub.textContent = `${WHERE[track] ?? ""} · ${list[0].bpm} BPM · ${list[0].key} · 루프 ${list[0].loop_seconds.toFixed(1)}초`;
  const box = document.createElement("div");
  box.className = "cands";
  for (const row of list) {
    const el = document.createElement("div");
    el.className = "cand";
    el.dataset.chosen = String(chosen[track] === row.id);
    const playBox = document.createElement("div");
    playBox.className = "cand__play";
    for (const [label, seam] of [["▶ 처음부터", false], ["▶ 이음매", true]] as const) {
      const b = document.createElement("button");
      b.textContent = label;
      b.dataset.play = row.id;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => (playing?.id === row.id && b.getAttribute("aria-pressed") === "true" ? stop() : void play(row, seam, b)));
      playBox.append(b);
    }
    const info = document.createElement("div");
    const name = document.createElement("p");
    name.className = "cand__name";
    name.textContent = VARIANT[row.variant] ?? row.variant;
    if (chosen[track] === row.id) {
      const tag = document.createElement("b");
      tag.textContent = "게임에 실림";
      name.append(tag);
    }
    const dl = document.createElement("dl");
    const item = (k: string, v: string) => {
      const d = document.createElement("div");
      d.innerHTML = "<dt></dt><dd></dd>";
      d.querySelector("dt")!.textContent = k;
      d.querySelector("dd")!.textContent = v;
      dl.append(d);
    };
    item("모티프 선율 일치", row.melody_match === null ? "–" : `${row.melody_match.toFixed(2)} (우연 ${row.melody_chance?.toFixed(2)})`);
    item("음량", `${row.lufs.toFixed(1)} LUFS`);
    item("이음매 닮음", (1 - row.seam_mismatch).toFixed(2));
    item("용량", kb(row.m4a_bytes));
    item("생성", `${row.gen_seconds.toFixed(0)}초에 ${row.audio_seconds}초 분량 (실시간의 ${row.realtime_x}배)`);
    item("시드", String(row.seed));
    const img = document.createElement("img");
    img.src = `./${row.seam}`;
    img.alt = "이음매 앞뒤 4초의 스펙트로그램";
    img.title = "이음매 앞뒤 4초(가운데가 이음매)";
    info.append(name, dl, img);
    el.append(playBox, info);
    box.append(el);
  }
  const cap = document.createElement("p");
  cap.className = "cand__cap";
  cap.textContent = `프롬프트: ${list[0].caption}`;
  tracksBox.append(h, sub, box, cap);
}

// 제작 기록 표
const table = document.getElementById("record") as HTMLTableElement;
table.innerHTML = "<tr><th>곡</th><th>후보</th><th>방식</th><th>시드</th><th>생성 시간</th><th>메모리(MLX 최대)</th><th>루프</th><th>음량</th></tr>";
for (const row of rows) {
  const tr = table.insertRow();
  for (const v of [row.title, row.variant, row.task === "cover" ? `cover ${row.cover_strength}` : "text2music", String(row.seed), `${row.gen_seconds.toFixed(0)}초`, row.mlx_peak_gb ? `${row.mlx_peak_gb}GB` : "–", `${row.loop_seconds.toFixed(1)}초`, `${row.lufs.toFixed(1)} LUFS`]) tr.insertCell().textContent = v;
}

// 게임에서 듣기: 음악을 켠 상태를 만들어 따로 떨어진 저장 칸에 넣고 연다
const SCENES = [
  { id: "home", label: "복도", preset: "daily-unsolved", hash: "" },
  { id: "play", label: "문제 풀이", preset: "daily-unsolved", hash: "daily" },
  { id: "exam", label: "제한 시간 시험(C→B)", preset: "ready-b", hash: "exam" },
  { id: "profile", label: "소리 설정(신분증)", preset: "promoted", hash: "profile" },
] as const;
const phone = document.getElementById("phone") as HTMLIFrameElement;
const sceneBox = document.getElementById("scene")!;
function open(scene: (typeof SCENES)[number]) {
  const state = buildDemoState(scene.preset, new Date());
  state.settings = { ...state.settings, music: true, sound: true };
  try {
    localStorage.setItem(`detective-academy:v1:audio-${scene.id}`, JSON.stringify(state));
  } catch {}
  phone.src = `../../index.html?demo=1&save=audio-${scene.id}&cine=0${scene.hash ? `#/${scene.hash}` : ""}`;
}
for (const scene of SCENES) {
  const b = document.createElement("button");
  b.textContent = scene.label;
  b.addEventListener("click", () => {
    for (const other of sceneBox.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
    open(scene);
  });
  sceneBox.append(b);
}
(sceneBox.querySelector("button") as HTMLButtonElement).click();
