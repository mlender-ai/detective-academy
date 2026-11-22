# 탐정학원 · DETECTIVE ACADEMY

탐정학원에 입학해 추리 문제를 풀고, 수사 크레딧을 모아 승급 시험에 합격하는 모바일 추론 게임의 플레이 가능한 프로토타입입니다.

입학 → 오늘의 추리 → 연습실 → 승급 시험으로 이어지고, 이 브랜치에서는 F급에서 S급까지 다섯 번의 승급을 실제로 플레이할 수 있습니다. 문제는 다섯 유형 38개입니다(일일 8 · 연습 15 · 시험 15).

**바로 해 보기:** <https://mlender-ai.github.io/detective-academy/> (휴대폰 사파리·크롬. 공유 → "홈 화면에 추가"를 하면 주소창 없이 전체 화면으로 열립니다.)

> 이 브랜치(`feat/v3-indie-experience`)는 V3 작업 중이다. 홈이 걸어 다니는 복도로, 암호 해독이 자료실 장면(책상의 기록 ↔ 금고의 자물쇠)으로 바뀌었고, 새 퍼즐 두 가지(증거 조합, 인장 대조)가 더해졌다. GATE 05 에서 오늘의 추리가 날짜별로 배정되고, 연습실이 등급별 서랍이 되고, 승급 시험이 F→S 다섯 단계(제한 시간 · 제출 횟수 · 하루 응시 횟수)가 됐다(`/lab/gate05/` 에서 장면을 골라 플레이). 위 주소의 배포본(main)은 아직 예전 홈과 예전 풀이 화면이고 문제는 셋이다. 진행 상황은 `lab/README.md`.

`main` 에 올리면 깃허브 액션이 단위 테스트와 빌드를 거쳐 자동으로 배포합니다(`.github/workflows/pages.yml`).

## 화풍 (2026-11-22 확정)

**1비트 흑백 도트** — 검정과 흰색 두 가지로만 찍은 화면입니다. 90년대 텍스트 어드벤처처럼 장면 아래에 글 한 줄이 한 자씩 찍히고, 사건을 열면 검은 자막 화면에 제목이 뜹니다. 점 하나는 2px, 글꼴은 90년대 도스 한글 글꼴을 되살린 Neo둥근모이고, 움직임은 몇 장면으로 끊어 보여 줍니다. 입학부터 신분증까지 전 화면이 이 화풍입니다. 규칙은 `DESIGN.md` 에 있습니다.

지나온 안은 보관되어 있습니다(푸는 법은 `docs/archive/README.md`).

- V3 에서 고르지 않은 화면(예전 홈, 홈 A안, 예전 암호 화면, 암호 A안): `docs/archive/v3-gate03-all-app/` 을 정적 서버로 열고 `compare-home.html` · `compare-play.html`
- 앞선 확정안 B안(픽셀 아트)과 비교용 시안 C안(누아르 카툰): `docs/archive/bcd-all-app/` 을 정적 서버로 열면 세 안을 나란히 볼 수 있습니다. 비교 그림은 `docs/compare/pairs/`
- 수채 드로잉(A안)과 픽셀 아트(B안)의 비교: `docs/compare/DETECTIVE_ACADEMY_AB_Compare.html`, `docs/archive/ab-both-app/`
- 처음의 V1(남색·금색 카드): `docs/v1/`

## 실행

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 <http://localhost:5183> 을 엽니다. 같은 와이파이의 휴대폰에서 확인하려면 `npm run dev:lan` 을 실행한 뒤 터미널에 표시되는 Network 주소로 접속합니다.

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (포트 5183) |
| `npm run build` | 타입 검사 후 `dist/` 에 빌드 |
| `npm run preview` | 빌드 결과 미리보기 (포트 4183) |
| `npm test` | 엔진 단위 테스트 (Vitest) — 정답 유일성 포함 |
| `npm run test:e2e` | 주요 플레이 흐름·화면 크기별 테스트 (Playwright) |
| `npm run verify` | 타입 검사 + 단위 테스트 + E2E 한 번에 |

E2E 테스트를 처음 돌리는 기기에서는 `npx playwright install chromium` 이 한 번 필요합니다.

### 그림 작업용 스크립트

| 명령 | 내용 |
|---|---|
| `node scripts/mono-art.mjs [corridor\|examroom\|desk]` | 배경(`src/assets/art/mono/*.png`) 굽기. 밝기를 그린 뒤 격자 점묘로 두 색으로 바꾼다 |
| `node scripts/shot.mjs <out.png> <프리셋> ["#/경로"] [--w 390 --h 844] [--click a,b]` | 개발 서버 화면 캡처 (검수용) |
| `node scripts/capture-all.mjs <폴더> --q cine=0 [--h 664] [--w 375] [--only 이름,…]` | 전 화면 30장을 한 번에 캡처. `cine=0` 은 자막 화면을 끈다 |
| `node scripts/to-webp.mjs <폴더> <폭> 이름=파일.png ...` | 캡처를 WebP 로 변환 |

## 상태별 화면 확인 (QA)

주소 끝에 `?demo=1` 을 붙이면 화면 왼쪽 가장자리에 `QA` 손잡이가 나타납니다. 일반 사용자 화면에는 나오지 않습니다.

- 첫 실행 상태로 초기화 / 오늘의 문제 미해결 / 오늘의 문제 해결
- 등급별: D급 시험 가능(F급) · D급 승급 완료 · C급 · B급 · A급 · S급 시험 가능 · S급 달성
- 다음 날로 / 실제 날짜로: 게임의 날짜를 옮긴다(오늘의 추리와 하루 응시 횟수가 그 날짜를 따른다)
- 오늘 응시 횟수 되돌리기

프리셋은 손으로 짜 맞춘 상태가 아니라 실제 엔진 함수를 순서대로 호출해 만듭니다(시험도 실제로 치러 올라갑니다).

주소로도 됩니다: `?demo=1&preset=ready-b&apply=1`(그 상태로 시작), `?demo=1&date=2026-11-25`(그 날짜로), `?demo=1&day=3`(일일 문제 3일차를 오늘의 추리 자리에), `&save=이름`(별도 저장 칸).

## 구조

```text
src/
  app/        앱 조립 — App, 해시 라우터, 저장소(localStorage), 게임의 시계(clock.ts: 검수용 날짜 옮기기), 효과음, 다음 행동 판단, 배경 그림(backdrop.ts), QA 패널
  engine/     화면과 무관한 순수 로직
    types.ts            문제·입력·저장 상태 타입
    puzzleValidator.ts  전수 탐색 정답 검증, 답안 채점, 힌트·해설 점검
    evidence.ts         증거 조합의 규칙 — 가능한 세계를 전부 만들어 모순·함의를 판정, 잇기 표 점검
    seal.ts             인장 대조의 규칙 — 격자 돌리기·뒤집기·찍기, 그림 자료 점검
    progressEngine.ts   입학·힌트·제출·보상·승급, 승급 시험 한 번의 진행(시작·시계·제출 횟수·실패·합격) (GameState → GameState)
    creditEngine.ts     크레딧 정책과 계산
    time.ts             Asia/Seoul 날짜, 날짜 계산, 시간 표기
  data/
    puzzles.ts          문제 등록부: 처음의 세 문제, 날짜별 오늘의 추리 배정(DAILY_CALENDAR), 연습실·시험 목록
    dailySet.ts         일일 문제 7개
    sets/               연습실과 승급 시험의 문제 28개 (유형별 파일: code · truth · schedule · evidence · seal)
    people.ts           문제에 나오는 학생들
    ranks.ts            등급, 승급 조건, 시험마다의 규칙(문제 · 제한 시간 · 제출 횟수 · 수사 지원 · 하루 응시 횟수 · 보상)
  art/        그림 재료 — pixel.tsx(격자에 점을 찍어 만든 스프라이트와 표시, 초상·엠블럼·휘장), objects.tsx(엠블럼·봉투·열쇠 등), portraits.tsx(학생 초상)
  assets/art/ 배경 — mono/(복도 세 장·시험실·책상)
  games/      퍼즐별 조작 화면 — CodeBreaker, TruthDeduction, SchedulePuzzle, EvidenceBoard(증거 조합), SealMatch(인장 대조)
  scene/      살아 있는 장면 — 점 찍는 도구, 탐정(관절 모형), 밝기 층을 점묘로 바꾸는 stage, 홈의 옆에서 본 복도(sideArt·sideScene), 암호 해독의 자료실(vaultArt·vaultScene)
  screens/    입학(복도), 홈(HomePlayable: 걸어 다니는 복도), 연습실(PracticeRoom: 등급별 서랍)·풀이(DeskPlay)·채점 결과(DeskResult)·신분증(책상),
              승급 시험(PromotionExam: 봉투 → 문제 → 다음 시험지 → 승급 또는 시험 종료)
              cases/  증거 조합(EvidencePlay)·인장 대조(SealPlay)의 풀이
              codeux/ 암호 해독의 풀이 — ScenePlay(자료실 장면, 기본) · NotebookPlay(수사 수첩, ?play=c 로만. 다른 문제용 후보)
              usePlaySession.ts 가 풀이 진행(입력·시간·제출·판정)을 맡고 화면은 그리기만 한다
  components/ 신분증, 인장, 시험 봉투, 힌트 서랍, 크레딧 꼬리표, 서술 한 줄(Narration), 자막 화면(CineCard)
  styles/     tokens.css(색·글꼴 이름) · 배치(base·components·art·hall·desk·rooms, @layer layout)
              · 겉모습(mono·mono-rooms. 그 아래에 pixel·pixel-rooms 를 mono-pixel.css 가 한 층으로 깐다)
              · 화면별(live 홈의 장면 · codeux 암호 풀이 · cases 증거·인장 · growth 연습실 서랍·시험 안내·등급별 휘장과 신분증)
  tests/      Vitest 단위 테스트
e2e/          Playwright 테스트 (solve.ts: 문제 자료를 읽어 화면의 조작만으로 답을 넣는 도우미)
scripts/      배경 굽기(mono-art), 화면 캡처(shot, capture-all), 캡처를 WebP 로(to-webp)
docs/screenshots/  E2E 테스트가 찍은 주요 화면
docs/compare/      안끼리 비교한 문서와 그림
docs/archive/      안을 고를 때마다 묶어 둔 소스·빌드본, 폐기한 후보
docs/v1/           V1 캡처와 빌드본
```

## 정답 검증 방식

문제 데이터에 적힌 `solution` 을 그대로 믿지 않습니다.

- **풀이**: 가능한 모든 경우를 만들어 규칙을 적용합니다. 암호는 120~3,024개, 진술은 범인 후보 4명, 순서는 24·120개, 증거 조합은 진술 × 증거의 모든 짝(12~32개), 인장 대조는 도장 × 방향 12·16개를 전부 검사합니다.
- **짜임새**: 증거 조합은 가능한 세계를 전부 만들어, 손으로 적은 '잇기 표'가 맞고 빠짐없는지와 거짓 진술이 정확히 하나인지를 봅니다. 인장 대조는 도장마다 점의 수가 같은지, 좌우 반전을 잊으면 고르게 되는 함정 도장이 있는지를 봅니다. 암호·진술·순서는 조건이 가리키는 자리와 사람이 맞는지, 남의 말을 가리키는 진술이 돌고 돌아 제자리로 오지 않는지를 봅니다.
- **군더더기와 겹침**: 새 문제는 기록·조건을 하나 빼면 답이 여럿이 되는지, 같은 유형의 다른 문제와 푸는 길(구조)이 다른지, 해설의 글이 말하는 중간 사실이 맞는지까지 테스트에 적었습니다(`src/tests/sets-*.test.ts`).
- **화면으로 닿는가**: 새 문제 28개는 화면의 조작만으로 오답과 정답을 내 보는 브라우저 테스트가 있습니다(`e2e/growth.spec.ts`).
- **유일성**: 조건을 만족하는 답이 정확히 1개이고 선언된 정답과 같은지 확인합니다. 문제 데이터를 고쳐 답이 0개 또는 2개 이상이 되면 `npm test` 가 실패합니다.
- **채점**: 플레이어 답안은 선언된 정답과 비교하지 않고 문제의 규칙으로 채점합니다.
- **힌트·해설**: 글과 함께 기계가 검사할 수 있는 사실(`facts`)을 적어 두고, 실제 정답과 모순되지 않는지, 힌트만으로 후보가 하나로 줄어 정답이 드러나지 않는지 점검합니다.

개발 서버에서는 같은 검사를 시작할 때 한 번 더 돌려 문제가 있으면 콘솔에 오류를 남깁니다.

## 바꾸기 쉬운 값

| 바꿀 것 | 위치 |
|---|---|
| 최초 지급 크레딧, 힌트 비용, 오늘의 추리·연습 과제의 보상 | `src/engine/creditEngine.ts` 의 `CREDIT_POLICY` (문제 자료의 `reward` 가 이 표와 같은지 테스트가 본다) |
| 문제의 단서, 힌트, 해설 | `src/data/puzzles.ts`, `src/data/dailySet.ts`, `src/data/sets/*.ts` |
| 등급 이름, 응시 조건(과제 수), 시험 문제, 제한 시간, 제출 횟수, 수사 지원, 하루 응시 횟수, 합격 보상 | `src/data/ranks.ts` 의 `RANKS`, `PROMOTION_RULES` |
| 날짜별 오늘의 문제 배정 | `src/data/puzzles.ts` 의 `DAILY_CALENDAR`(시작일과 문제 순서) |
| 두 가지 색, 글꼴, 점묘 | `src/styles/mono.css` 맨 위의 `:root[data-art="mono"]` |
| 홈의 서술 문장, 줄마다의 내용 | `src/screens/HomePlayable.tsx` |
| 복도의 물건 자리, 설 자리, 누를 영역 | `src/scene/sideArt.ts` 의 `BOX`, `src/scene/sideScene.ts` 의 `SPOTS` |
| 자막 화면의 빠르기 | `src/components/CineCard.tsx` 의 `TYPE_MS`·`HOLD_MS` |

응시 조건·시험 규칙·크레딧 수치는 모두 초기 실험값입니다. 지금의 값:

| 승급 | 응시 조건 | 문제 | 제한 시간 | 제출 | 수사 지원 | 하루 응시 | 합격 보상 |
|---|---|---|---|---|---|---|---|
| F→D | 과제 3개 | 1 | 없음 | 제한 없음 | 가능 | 제한 없음 | +80 |
| D→C | 과제 5개 | 2 | 없음 | 제한 없음 | 가능 | 제한 없음 | +100 |
| C→B | 과제 8개 | 3 | 15분 | 제한 없음 | 가능 | 3번 | +120 |
| B→A | 과제 12개 | 4 | 없음 | 문제마다 3번(진술은 2번) | 없음 | 2번 | +160 |
| A→S | 과제 15개 | 5 | 25분 | 문제마다 2번(진술은 1번) | 없음 | 1번 | +200 |

"과제"는 처음 해결한 오늘의 추리와 연습 과제를 합친 수이고, 입학부터 쌓인 수로 셉니다. 크레딧은 입학 40, 수사 지원 20·40, 오늘의 추리 +60, 연습 과제 +30~50(등급별)입니다.

## 저장

진행 상태는 브라우저 `localStorage` 의 `detective-academy:v1` 키에 저장됩니다. 입학 여부, 닉네임, 등급, 크레딧, 문제별 상태·입력값·힌트 단계·풀이 시간·제출 횟수·보상 수령 여부, 승급 기록, 치르고 있는 시험(문제 순번·남은 시간·쓴 제출 횟수), 등급별 오늘의 응시 횟수, 효과음 설정이 들어갑니다. 서버·계정은 없습니다.

시험의 남은 시간과 횟수는 저장된 값에서 이어지므로 새로고침으로 되돌아가지 않습니다. 다만 브라우저 저장소는 사용자가 고칠 수 있어 조작을 막지는 못합니다. 순위 같은 경쟁 기능을 붙일 때는 시험 한 번의 기록(`ExamSession`)을 서버로 옮겨 검증해야 합니다.

`detective-academy:cine` 키를 `off` 로 두면 사건을 열 때의 자막 화면이 뜨지 않습니다(자동 테스트가 씁니다. 주소에 `cine=0` 을 붙여도 같습니다). `detective-academy:date` 키에 날짜(`2026-11-22`)를 두면 게임의 날짜가 그날로 옮겨집니다(QA 패널의 "다음 날로"와 자동 테스트가 씁니다).

## 이번 버전에 없는 것

스토리 모드, 서버·계정·순위표, 결제·광고, 푸시 알림, AI 문제 생성, 특별 시험 모드, 상점.
