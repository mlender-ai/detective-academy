# 보관

- `ab-both-2026-11-21-src.tar.gz` — A안(수채 드로잉)과 B안(픽셀 아트)이 함께 들어 있던 마지막 소스. 2026-11-21 에 B안으로 확정하면서 A안을 걷어내기 직전에 묶었다.
  풀기: `mkdir ab && tar xzf ab-both-2026-11-21-src.tar.gz -C ab` 후 `npm install`, `npm run dev`. 주소 끝의 `?art=ink` / `?art=pixel` 로 화풍을 바꾼다.
- `ab-both-app/` — 같은 시점의 빌드본. 정적 서버로 열면 된다 (`npx vite preview --outDir docs/archive/ab-both-app`). `compare.html` 로 두 안을 나란히 볼 수 있다.
- 처음의 V1(남색·금색 카드)은 `docs/v1/` 에 있다.
- `characters-discarded-2026-11-21.tar.gz` — 탐정 캐릭터 그림체 후보 일곱 가지(망점·판화·점묘·크레용·마른 붓·마커·연필)의 SVG 원본, 모음 그림, 만드는 스크립트(`scripts/character-lab`). 2026-11-22 에 사용자가 전부 폐기해 작업 폴더에서 걷어내기 전에 묶었다.
  풀기: `tar xzf characters-discarded-2026-11-21.tar.gz` (원래 경로대로 풀린다). 다시 만들려면 `scripts/character-lab` 에서 `npm install && node make.mjs && node render.mjs`.
- `bcd-all-2026-11-22-src.tar.gz` — B안(픽셀 아트)·C안(누아르 카툰)·D안(1비트 흑백 도트)이 함께 있던 소스. 2026-11-22 에 D안으로 확정하고 기본 진입점을 바꾸기 직전에 묶었다. 이때는 `index.html` 이 B안, `mono.html` 이 D안이었다.
  풀기: `mkdir bcd && tar xzf bcd-all-2026-11-22-src.tar.gz -C bcd` 후 `npm install`, `npm run dev`. `compare.html` 로 세 안을 나란히 볼 수 있다.
- `DESIGN-B-pixel-2026-11-21.md` — B안(픽셀 아트)의 디자인 문서. D안으로 확정하면서 `DESIGN.md` 를 새로 쓰기 전의 것이다.
- `bcd-final-2026-11-22-src.tar.gz` — B안·C안·D안이 함께 있던 마지막 소스. 2026-11-22 에 D안으로 확정한 뒤, B안·C안 파일을 걷어내기 직전에 묶었다. 이때는 `index.html` 이 D안, `pixel.html` 이 B안, `noir.html` 이 C안이다. 테스트·문서·`docs/screenshots`(B안 때의 `pixel-*.png` 포함)도 들어 있다.
  풀기: `mkdir bcd-final && tar xzf bcd-final-2026-11-22-src.tar.gz -C bcd-final` 후 `npm install`, `npm run dev`.
- `bcd-all-app/` — 같은 시점의 빌드본(28MB). 정적 서버로 열면 된다 (`npx vite preview --outDir docs/archive/bcd-all-app --port 4190`). `compare.html` 로 세 안을 나란히 볼 수 있다.
- `v3-gate03-all-2026-11-22-src.tar.gz` — V3 의 GATE 02(메인 홈)·GATE 03(암호 풀이 화면)에서 견준 화면이 모두 들어 있던 마지막 소스. 2026-11-22 에 사용자가 홈은 B안(플레이 가능한 복도), 암호 풀이는 B안(장면 전개)을 고르고 "보관하고 걷어내기"라고 해서, 예전 홈·홈 A안(시네마틱 복도)·예전 암호 화면·암호 A안(접기·펼치기)을 걷어내기 직전에 묶었다. C안(수사 수첩)은 걷어내지 않았다. 테스트·실험실(`lab/`)·`docs/screenshots` 가 들어 있고, 큰 비교 자료(`docs/compare`·`docs/v1`·`docs/archive`)는 뺐다.
  풀기: `mkdir v3-gate03 && tar xzf v3-gate03-all-2026-11-22-src.tar.gz -C v3-gate03` 후 `npm install`, `npm run dev`. 홈은 `?home=old` · `?home=a`, 암호 풀이는 `?play=old` · `?play=a` · `?play=c` 로 바꾼다. 나란히 보기는 `/lab/gate02/` · `/lab/gate03/`.
- `v3-gate03-all-app/` — 같은 시점의 빌드본(2.2MB). 정적 서버로 열면 된다 (`npx vite preview --outDir docs/archive/v3-gate03-all-app --port 4191`). `compare-home.html` 로 세 홈을, `compare-play.html` 로 네 암호 풀이 화면을 나란히 볼 수 있다(실험실의 비교 페이지를 옮겨 온 것).
