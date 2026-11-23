---
name: playcheck
description: 탐정학원의 실제 게임 검수. 게임의 화면·규칙·그림·소리를 바꾼 뒤 "테스트 통과"가 아니라 실제 실행 결과로 확인할 때 쓴다. 개발 서버 실행, 브라우저 화면 확인, 퍼즐 직접 플레이, 모바일 크기와 터치, 전후 스크린샷 비교, Vitest·Playwright, 독립 QA 평가까지의 절차와 명령.
---

# 실제 게임 검수 (playcheck)

게임을 바꾼 작업은 아래를 거친 뒤에 "했다"고 말한다. 건너뛴 단계는 건너뛰었다고 적는다. **테스트 통과는 깨지지 않았다는 뜻이지, 좋아졌다는 뜻이 아니다.**

## 1. 개발 서버

```bash
npm run dev            # http://localhost:5183 (이미 떠 있으면 다시 띄우지 않는다)
```

휴대폰에서 볼 때는 `npx vite --config lab/vite.lan.config.ts` (5184, 같은 와이파이).

## 2. 실제 화면을 눈으로 본다

```bash
node scripts/shot.mjs <out.png> <프리셋|-> [#/route] --q cine=0 [--w 390] [--h 664] [--click a,b]
node scripts/capture-all.mjs <폴더> --q cine=0 [--h 664] [--w 375]     # 전 화면
```

프리셋: `first-run` `daily-unsolved` `daily-solved` `exam-ready` `promoted` `ready-c` `ready-b` `ready-a` `ready-s` `rank-s`. 주소로는 `?demo=1&save=<칸>&preset=<이름>&apply=1&cine=0&date=2026-11-22`. 찍은 PNG 를 직접 열어 본다. 미리보기 창은 백그라운드에서 타이머가 느려지므로 흐름은 Playwright 로 본다.

## 3. 바뀐 것을 직접 플레이한다

화면의 조작만으로(터치 켜고) 처음부터 끝까지 간다. 정상 흐름과 함께 오답, 새로고침, 나갔다 오기, 연타, 모션 줄이기를 본다.

- 문제 풀기: `e2e/solve.ts` 의 `solve(page, puzzle)` · `submitWrong`
- 암호(자료실): `e2e/helpers.ts` 의 `toSafe` · `toDesk`
- 사건: `e2e/story.spec.ts` 의 `openCase` · `investigate` · `pickRecord` · `linkFacts` · `solve`
- 저장된 상태를 고칠 때: `patchState`(풀이 화면이 1초마다 저장하므로 빈 문서로 나가서 고친다)

## 4. 모바일 크기와 터치

390×844 · **390×664**(주소창이 보이는 모바일) · **375×629**(아이폰 13 미니 사파리) · 430×932.

- 주 단추가 화면 안에 있는가, 누를 것이 44px 이상인가, 아래 단추 줄이 조작부를 가리지 않는가
- 홈은 375×629 에서도 스크롤 없이 모든 줄이 보이는가
- 넘치는 화면은 몇 px 넘치는지 잰다(`scrollHeight - clientHeight`)

## 5. 전후를 화소로 견준다

기존 화면이 달라지지 않았는지 본다. 움직이는 장면은 켠 채로 찍으면 매번 다르므로:

1. 작업 전 커밋을 임시 폴더에 꺼낸다(`git worktree add --detach <임시> <커밋>`, `node_modules` 는 심볼릭 링크).
2. **빌드본끼리** 견준다(`npx vite build` 후 `npx vite preview --port <포트>`). 임시 폴더의 개발 서버는 글꼴 파일을 읽지 못해 비교가 틀어진다.
3. 모션 줄이기(`reducedMotion: "reduce"`) + 시각 고정(`page.clock.install`) + 날짜 고정(`date=`)으로 같은 화면을 찍는다. QA 손잡이(`.demo`)는 숨긴다.
4. 달라진 화소가 0 이 아닌 화면만 눈으로 본다. 의도한 변경인지 가른다.
5. 임시 폴더는 `git worktree remove` 로 지운다.

눈에 띄게 달라지는 변경은 기존 것과 나란히 놓은 비교 페이지(`lab/<이름>/`)로 만든다.

## 6. 자동 테스트

```bash
npm run verify         # 타입 검사 + Vitest + Playwright(빌드본)
```

- 문제·힌트·해설을 고쳤으면: 정답 유일성, 군더더기 없음, 해설의 사실이 테스트에 있는가(상수 비교로 끝나지 않는가)
- 보상·시험 규칙을 고쳤으면: 처음 한 번만 주는가, 시간·제출 횟수·하루 응시가 새로고침으로 되돌아가지 않는가
- 저장 형식을 고쳤으면: 예전 저장을 읽는 테스트가 있는가
- 화면을 고쳤으면: 두 색만 쓰는지 화소를 센다(`offToneRatio < 0.005`)

**이 테스트들은 `modes.rigor: minimal` 을 이유로 생략하지 않는다.**

## 7. 사파리 엔진

이 프로젝트의 Playwright 에는 WebKit 이 없다. 다른 곳에 설치된 Playwright 가 있으면:

```bash
PW=<경로>/node_modules/@playwright/test node scripts/capture-all.mjs <폴더> --q cine=0 --engine webkit
```

없으면 "WebKit 미확인"이라고 적는다. 실제 휴대폰에서 보지 않았으면 봤다고 쓰지 않는다. (공개 저장소이므로 `PW` 의 경로를 파일에 적지 않는다.)

## 8. 독립 QA

구현자와 다른 역할에 맡긴다(`qa-tester`, 그림은 `art-director`, 흐름은 `ux-designer`). 맡길 때 주는 것은 **산출물**이다: 볼 주소, 캡처 경로, 바뀐 파일 목록, 지켜야 할 기준. 구현자의 결론("잘 됩니다")은 주지 않는다. 판정(`통과 / 조건부 통과 / 반려`)과 근거를 받는다.

## 9. 증거를 남긴다

필요한 스크린샷과 간결한 결과만 남긴다.

- 캡처: `docs/compare/<주제>/` (모아 붙인 한두 장)
- 결과: `lab/README.md` 의 해당 절에 표 하나와 몇 줄(무엇을, 어떤 크기·엔진에서, 결과, 하지 못한 것)

## 보고 양식

```
바꾼 것: …
실제로 본 것: (주소 / 크기 / 엔진) …
직접 플레이: (어디서 어디까지, 오답·새로고침 포함 여부) …
전후 비교: N 화면 가운데 달라진 것 M (의도한 것 / 아닌 것)
자동 테스트: 단위 N · 브라우저 M 통과
독립 검수: (역할) 판정과 근거
하지 못한 것: (WebKit / 실제 휴대폰 / 소리 등)
```
