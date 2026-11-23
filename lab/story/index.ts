// 사건 수사 검수 페이지. 장면을 고르면 그 지점까지 진행된 상태를 실제 엔진 함수로 만들어 따로 떨어진 저장 칸에 넣고 연다.
// 답은 적어 두지 않는다: 장마다의 판정에 물어 찾는다(테스트가 쓰는 도우미 src/tests/story/d001-play.ts 를 함께 쓴다).
// 주소에 ?go=<장면 이름> 을 붙이면 그 장면의 상태를 넣고 곧바로 앱을 연다(캡처 스크립트가 쓴다).
import type { GameState } from "../../src/engine/types";
import { finishEnding, goScene, seeIntro } from "../../src/story/engine/storyEngine";
import type { StoryChapter } from "../../src/story/engine/storyTypes";
import { c, detective, playScene, submitCorrect, upTo } from "../../src/tests/story/d001-play";

type Stop = "new" | "ending" | "record" | number;

/** 그 장의 그 지점에 막 들어선 상태까지 엔진으로 진행한다 (앞 장들은 모두 해결한 채로) */
function stateAt(ch: StoryChapter, stop: Stop): GameState {
  let s = upTo(ch, detective());
  if (stop === "new") return s;
  s = seeIntro(s, c, ch);
  for (const [i, scene] of ch.scenes.entries()) {
    s = goScene(s, c, ch, scene.id);
    if (stop === i) return s;
    s = playScene(s, ch, scene);
  }
  s = submitCorrect(s, ch).state;
  return stop === "ending" ? s : finishEnding(s, c, ch);
}

interface Scene {
  id: string;
  mark: string;
  title: string;
  sub: string;
  /** 엔진으로 만들 상태. 없으면 프리셋 주소로 연다. */
  at?: () => GameState;
  preset?: string;
  hash: string;
}

const KIND: Record<string, string> = {
  timeline: "타임라인으로 시점을 옮기고 화면의 곳곳을 눌러 조사한다",
  records: "여러 기록 가운데 물음에 맞는 하나를 고른다",
  link: "두 기록에서 하나씩 골라 맞대어 사실을 확정한다",
  deduce: "결론과 근거가 되는 증거를 함께 낸다",
  compare: "두 영상을 같은 시점에서 견주고 달라진 곳을 직접 짚는다",
  order: "뒤섞인 기록 카드를 끌거나 맞바꿔 일어난 순서로 놓는다",
  testimony: "진술 하나와 기록 한 줄을 골라 맞대어 본다",
  assign: "시각 순서의 줄마다 그 일을 한 사람을 넣는다",
};

const [first] = c.chapters;
const last = c.chapters[c.chapters.length - 1];
const SCENES: Scene[] = [
  { id: "home", mark: "홈", title: "홈 · 새 사건 접수", sub: "D급의 학원 홀. 사건 접수함(낡은 텔레비전). 여기서부터 처음 그대로 플레이한다", at: () => stateAt(first, "new"), hash: "" },
  { id: "file", mark: "접수", title: "사건 접수 → 도입", sub: "사건 파일을 보고 수락하면 도입 글(누르면 넘어가고, 건너뛸 수 있다)", at: () => stateAt(first, "new"), hash: `story/${c.id}` },
  ...c.chapters.flatMap((ch): Scene[] => [
    ...(ch === first ? [] : [{ id: `c${ch.no}-intro`, mark: `${ch.no}`, title: `제${ch.no}장 도입 · ${ch.title}`, sub: "장의 제목과 도입 글. 한 번만 나온다", at: () => stateAt(ch, "new"), hash: `story/${c.id}/${ch.id}` }]),
    ...ch.scenes.map((scene, i) => ({
      // 저장 칸의 이름은 16자까지다: 장면의 이름표 대신 번호를 쓴다
      id: `c${ch.no}-${i + 1}`,
      mark: `${ch.no}-${i + 1}`,
      title: `제${ch.no}장 · ${scene.title}`,
      sub: KIND[scene.kind],
      at: () => stateAt(ch, i),
      hash: `story/${c.id}/${ch.id}`,
    })),
    { id: `c${ch.no}-end`, mark: `${ch.no}끝`, title: `제${ch.no}장 끝 장면 → 결과`, sub: `${ch.ending.still ?? "끝 장면"} 끝 글, 새 기록, CHAPTER 0${ch.no} CLEARED`, at: () => stateAt(ch, "ending"), hash: `story/${c.id}/${ch.id}` },
    { id: `c${ch.no}-rec`, mark: `${ch.no}록`, title: `사건 기록 (제${ch.no}장 해결 뒤)`, sub: "네 장의 상태, 풀 차례의 장으로 이어 가기, 끝낸 장 다시 풀기, 증거 기록", at: () => stateAt(ch, "record"), hash: `story/${c.id}/record` },
  ]),
  { id: "home2", mark: "끝", title: "홈 · 사건 해결 뒤", sub: "사건 접수함이 사건 해결로 바뀌고 텔레비전이 꺼진다", at: () => stateAt(last, "record"), hash: "" },
  { id: "f", mark: "F", title: "F급의 홈", sub: "사건을 맡을 수 없는 등급: 접수함이 없다", preset: "daily-unsolved", hash: "" },
];

const BASE = "detective-academy:v1";
let current = SCENES[0];
let size = "390x844";

const seed = (scene: Scene) => {
  if (!scene.at) return;
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`${BASE}:st-${scene.id}:`)) localStorage.removeItem(key);
    localStorage.setItem(`${BASE}:st-${scene.id}`, JSON.stringify(scene.at()));
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

// 캡처용: 그 장면의 상태를 넣고 앱으로 곧장 간다
const direct = SCENES.find((scene) => scene.id === new URLSearchParams(location.search).get("go"));
if (direct) {
  seed(direct);
  location.replace(url(direct, true));
}

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
