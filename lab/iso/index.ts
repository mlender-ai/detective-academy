// 예전 홈(옆에서 본 복도)과 쿼터뷰 홈을 같은 저장 상태 · 같은 크기로 나란히 놓는다. 둘 다 제품 화면 그대로다(주소의 view 값만 다르다).
const SCENES = [
  { id: "first", label: "F급 · 오늘의 추리 전", preset: "daily-unsolved" },
  { id: "solved", label: "F급 · 오늘의 추리 뒤", preset: "daily-solved" },
  { id: "exam", label: "F급 · 시험 응시 가능", preset: "exam-ready" },
  { id: "d", label: "D급 · 사건 접수함", preset: "promoted" },
  { id: "s", label: "S급", preset: "rank-s" },
] as const;
const SIZES = [
  [390, 844],
  [390, 664],
  [375, 629],
  [430, 932],
] as const;

const q = new URLSearchParams(location.search);
let scene: (typeof SCENES)[number] = SCENES.find((s) => s.id === q.get("scene")) ?? SCENES[0];
let size: readonly [number, number] = SIZES.find(([w, h]) => `${w}x${h}` === q.get("size")) ?? SIZES[0];
const DATE = "2026-11-22";

const url = (iso: boolean) => {
  const p = new URLSearchParams({ demo: "1", save: `iso-${scene.id}-${iso ? "b" : "a"}`, preset: scene.preset, apply: "1", cine: "0", date: DATE });
  p.set("view", iso ? "iso" : "side");
  return `../../index.html?${p}`;
};

const phones = document.getElementById("phones")!;
function render() {
  phones.innerHTML = "";
  for (const iso of [false, true]) {
    const fig = document.createElement("figure");
    const frame = document.createElement("iframe");
    frame.className = "phone";
    frame.id = iso ? "after" : "before";
    frame.width = String(size[0]);
    frame.height = String(size[1]);
    frame.title = iso ? "쿼터뷰 학원 홀" : "지금의 홈";
    frame.src = url(iso);
    const cap = document.createElement("figcaption");
    cap.innerHTML = iso
      ? `<b>쿼터뷰 학원 홀 (지금의 기본 홈)</b>방을 눌러 걷는다 · 문과 물건을 눌러 살펴본다<br><a href="${url(true)}" target="_blank" rel="noopener">이 화면만 새 창으로</a>`
      : `<b>예전 홈 (?view=side)</b>옆에서 본 복도 + 명령 창(갈 곳의 목록)<br><a href="${url(false)}" target="_blank" rel="noopener">이 화면만 새 창으로</a>`;
    fig.append(frame, cap);
    phones.append(fig);
  }
}

function segment<T>(host: HTMLElement, items: readonly T[], label: (t: T) => string, isOn: (t: T) => boolean, pick: (t: T) => void) {
  const draw = () => {
    host.innerHTML = "";
    for (const item of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label(item);
      b.setAttribute("aria-pressed", String(isOn(item)));
      b.addEventListener("click", () => {
        pick(item);
        draw();
        render();
      });
      host.append(b);
    }
  };
  draw();
}

segment(document.getElementById("scene")!, SCENES, (s) => s.label, (s) => s === scene, (s) => (scene = s));
segment(document.getElementById("size")!, SIZES, ([w, h]) => `${w}×${h}`, (s) => s === size, (s) => (size = s));
render();
