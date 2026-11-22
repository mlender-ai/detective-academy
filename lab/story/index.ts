// 사건 수사 검수 페이지. 장면을 고르면 그 지점까지 진행된 상태를 실제 엔진 함수로 만들어 따로 떨어진 저장 칸에 넣고 연다.
import { buildDemoState } from "../../src/engine/progressEngine";
import type { GameState } from "../../src/engine/types";
import { D001, D001_CH1 } from "../../src/story/cases/d001/case";
import { finishEnding, goScene, investigate, linkItems, pickRecord, seeIntro, submitDeduction } from "../../src/story/engine/storyEngine";

const c = D001;
const ch = D001_CH1;
const NOW = new Date();
const [broadcast, log, analysis, deduction] = ch.scenes;

/** 그 장면에 막 들어선 상태까지 엔진으로 진행한다 */
function stateAt(stop: "new" | "broadcast" | "log" | "analysis" | "deduction" | "ending" | "record"): GameState {
  let s = buildDemoState("promoted", NOW);
  if (stop === "new") return s;
  s = seeIntro(s, c, ch);
  if (stop === "broadcast") return s;
  if (broadcast.kind === "timeline") for (const point of broadcast.points.filter((x) => x.required)) s = investigate(s, c, ch, broadcast.id, point.id).state;
  s = goScene(s, c, ch, log.id);
  if (stop === "log") return s;
  const right = ["A", "B", "C"].find((id) => pickRecord(s, c, ch, log.id, id).outcome.correct)!;
  s = pickRecord(s, c, ch, log.id, right).state;
  s = goScene(s, c, ch, analysis.id);
  if (stop === "analysis") return s;
  if (analysis.kind === "link") for (const link of analysis.links) s = linkItems(s, c, ch, analysis.id, link.a, link.b).state;
  s = goScene(s, c, ch, deduction.id);
  if (stop === "deduction") return s;
  if (deduction.kind === "deduce") {
    done: for (const choice of deduction.choices)
      for (const basis of deduction.basis) {
        const result = submitDeduction(s, c, ch, deduction.id, choice.id, basis, NOW);
        if (result.outcome.verdict === "correct") {
          s = result.state;
          break done;
        }
      }
  }
  if (stop === "ending") return s;
  return finishEnding(s, c, ch);
}

interface Scene {
  id: string;
  mark: string;
  title: string;
  sub: string;
  /** 엔진으로 만들 상태. 없으면 프리셋 주소로 연다. */
  at?: Parameters<typeof stateAt>[0];
  preset?: string;
  hash: string;
}

const SCENES: Scene[] = [
  { id: "home", mark: "1", title: "홈 · 새 사건 접수", sub: "D급의 복도. 「사건 수사」 줄과 창 아래의 텔레비전. 여기서부터 처음 그대로 플레이한다", at: "new", hash: "" },
  { id: "file", mark: "2", title: "사건 접수 → 도입", sub: "사건 파일을 보고 수락하면 도입 글 다섯 줄(누르면 넘어가고, 건너뛸 수 있다)", at: "new", hash: "story/d001" },
  { id: "s1", mark: "3", title: "SCENE 01 · 마지막 방송", sub: "타임라인으로 시점을 옮기고 화면의 곳곳을 눌러 조사한다 → 증거 01", at: "broadcast", hash: "story/d001" },
  { id: "s2", mark: "4", title: "SCENE 02 · 수상한 전송 기록", sub: "세 줄 가운데 마지막 방송을 실어 보낸 기록을 고른다 → 증거 02 · 03", at: "log", hash: "story/d001" },
  { id: "s3", mark: "5", title: "SCENE 03 · 증거 분석", sub: "두 기록에서 하나씩 골라 맞대어 사실 셋을 확정한다", at: "analysis", hash: "story/d001" },
  { id: "s4", mark: "6", title: "SCENE 04 · 최종 추론", sub: "결론 하나와 근거가 되는 증거 하나를 함께 낸다", at: "deduction", hash: "story/d001" },
  { id: "end", mark: "7", title: "끝 장면 → 결과", sub: "LIVE 표시가 꺼지고, 끝 글 두 줄, 새 기록(증거 04), CHAPTER 01 CLEARED", at: "ending", hash: "story/d001" },
  { id: "rec", mark: "8", title: "사건 기록 (해결 뒤)", sub: "확인된 것 · 아직 모르는 것 · 증거. 여기서 장면을 다시 본다", at: "record", hash: "story/d001" },
  { id: "home2", mark: "9", title: "홈 · 해결 뒤", sub: "「사건 수사」 줄이 1장 해결로 바뀌고 텔레비전이 꺼진다", at: "record", hash: "" },
  { id: "f", mark: "F", title: "F급의 홈", sub: "사건을 맡을 수 없는 등급: 줄도 텔레비전도 없다(기존 홈 그대로)", preset: "daily-unsolved", hash: "" },
];

const BASE = "detective-academy:v1";
let current = SCENES[0];
let size = "390x844";

const seed = (scene: Scene) => {
  if (!scene.at) return;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`${BASE}:st-${scene.id}:`)) localStorage.removeItem(key);
    localStorage.setItem(`${BASE}:st-${scene.id}`, JSON.stringify(stateAt(scene.at)));
  } catch {
    // 저장하지 못하면 그 칸은 입학 화면에서 시작한다
  }
};

const url = (scene: Scene, fresh: boolean) => {
  const q = new URLSearchParams({ demo: "1", save: `st-${scene.id}` });
  if (scene.preset) {
    q.set("preset", scene.preset);
    if (fresh) q.set("apply", "1");
  }
  return `../../index.html?${q}${scene.hash ? `#/${scene.hash}` : ""}`;
};

const phone = document.getElementById("phone") as HTMLIFrameElement;
const render = (fresh = true) => {
  const [w, h] = size.split("x").map(Number);
  if (fresh) seed(current);
  phone.width = String(w);
  phone.height = String(h);
  phone.src = "about:blank";
  requestAnimationFrame(() => (phone.src = url(current, fresh)));
  for (const b of document.querySelectorAll<HTMLElement>(".scene")) b.setAttribute("aria-pressed", String(b.dataset.id === current.id));
};

const box = document.getElementById("scenes")!;
for (const scene of SCENES) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.className = "scene";
  button.dataset.id = scene.id;
  button.innerHTML = `<b></b><span></span><i></i>`;
  button.querySelector("b")!.textContent = scene.mark;
  button.querySelector("span")!.textContent = scene.title;
  button.querySelector("i")!.textContent = scene.sub;
  button.addEventListener("click", () => {
    current = scene;
    render();
  });
  // 휴대폰: 누르는 순간 그 장면의 상태를 만들어 넣고 전체 화면으로 연다
  const open = document.createElement("a");
  open.className = "open";
  open.href = url(scene, true);
  open.textContent = `${scene.title} 전체 화면으로 열기`;
  open.addEventListener("click", () => seed(scene));
  li.append(button, open);
  box.append(li);
}

const sizeBox = document.getElementById("size")!;
sizeBox.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  for (const other of sizeBox.querySelectorAll("button")) other.setAttribute("aria-pressed", String(other === b));
  size = b.dataset.v!;
  render(false);
});
document.getElementById("again")!.addEventListener("click", () => render(true));
document.getElementById("resume")!.addEventListener("click", () => render(false));
render();
