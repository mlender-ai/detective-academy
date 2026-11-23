# 탐정학원 스튜디오

Claude Code Game Studios(CCGS, <https://github.com/Donchitos/Claude-Code-Game-Studios>, MIT)를 검토해 탐정학원에 맞는 것만 들인 기록이다(2026-11-22, 사용자의 "AI Game Studio & ASCII Animation Integration" 지시). 이 문서 하나가 스튜디오의 기준이다. GDD·스프린트 문서·회의록은 만들지 않는다.

- 역할 정의: `.claude/agents/*.md` (10개)
- 진행 방법: `.claude/skills/studio/SKILL.md` (`/studio`)
- 실제 게임 검수: `.claude/skills/playcheck/SKILL.md` (`/playcheck`)
- 운영 값: `project.yaml` (`modes.rigor: minimal`)

## 1. CCGS 에 있는 것 (1.3.0, 커밋 abc0de7 기준)

| 묶음 | 분량 | 하는 일 |
|---|---|---|
| 에이전트 | 49개 | 디렉터 3 · 부서 리드 · 전문가. 엔진 전문가는 Godot · Unity · Unreal 만 있다(Web 전문가는 없다) |
| 스킬 | 78개 | `/start` · `/adopt` · GDD·ADR·스토리 작성과 검토 · 스프린트 · 릴리스 · `team-*` 묶음 |
| 훅 | 18개 (5,823줄) | 세션 시작, 커밋·푸시 검사, 모든 읽기·쓰기·편집 검사, 알림, 하위 에이전트 기록 |
| 스크립트 | 54개 | 스킬이 부르는 도우미(문서 구조 검사, 상태 읽기 등) |
| 규칙 | 14개 | 경로별 코딩 규칙(`src/gameplay/**` 등) |
| 설정 | `settings.json` | 상태 줄, 자기 스크립트의 허용 31줄, 파괴적 명령 차단 130줄, 여덟 가지 이벤트에 훅 명령 15개 |
| `project.yaml` | | 엔진 · 운영 방식(`modes`) · 명령 · 성능 목표. 스킬과 훅이 `yaml-helper.sh` 로 읽는다 |

**`modes.rigor`** 는 여섯 값을 한꺼번에 정한다.

| rigor | workflow | docs.density | qa.level | story_granularity | review_mode | team.size |
|---|---|---|---|---|---|---|
| `minimal`(기본) | minimal | terse | minimal | coarse | solo | individual |
| `standard` | standard | balanced | standard | balanced | lean | individual |
| `full` | full | thorough | full | fine | full | studio |

`qa.level: minimal` 은 "논리 변경에 테스트 없음, 게이트에 테스트 없음"이고 `review_mode: solo` 는 "검수 없음"이다. 그래서 탐정학원은 rigor 는 `minimal` 로 두되 이 둘만 올렸다(`qa.level: standard`, `review_mode: lean`).

**Web 지원**: 엔진 표(`.claude/engines/engines.tsv`)에 Web 행이 있다(코드 `src`, 테스트 `tests`, 에셋 `assets`, `npm run dev|build|test|smoke`). Vite + Playwright 의 새 프로젝트 틀(`engines/web/scaffold`)을 깔아 주는 방식이라 **이미 있는 웹 프로젝트를 읽어 맞추는 기능은 없다.** 탐정학원은 테스트가 `src/tests` 와 `e2e`, 에셋이 `src/assets` 에 있어 기본값과 다르다.

**`/adopt`**: 기존 프로젝트의 GDD · ADR · 스토리 문서가 CCGS 의 형식에 맞는지 검사해 `docs/adoption-plan-<날짜>.md` 를 쓴다. 형식 검사이지 코드 도입 도구가 아니다. 탐정학원에는 그 형식의 문서가 없으므로 돌리면 "문서를 새로 써라"는 계획이 나온다(하지 않는다).

## 2. 탐정학원과 부딪히는 곳

| CCGS | 탐정학원 | 부딪히는 점 |
|---|---|---|
| `CLAUDE.md` (협업 규약: 쓰기 전에 매번 "May I write…?") | `CLAUDE.md` (사용자가 정한 기준과 진행 기록) | 덮어쓰면 기준이 사라진다. 규약도 "승인된 범위에서는 묻지 않고 진행"과 반대다 |
| `docs/`(구조·API 문서), `design/`, `production/` | `docs/`(캡처·비교·보관) | 스킬이 `design/gdd`, `production/session-state` 등을 만들어 문서가 늘어난다 |
| 훅: 모든 Read · Write · Edit · Bash 앞뒤 | 훅 없음 | 훅이 CCGS 의 폴더 구조(등록부, GDD 형식)를 전제로 검사한다. 탐정학원의 파일은 그 구조가 아니다 |
| `update-check.sh` | | 세션을 시작할 때 GitHub API 에 접속하고 `~/.cache/claude-code-game-studios/` 에 쓴다 |
| `settings.json` 의 `permissions` | 설정 파일 없음 | 자기 스크립트 31개를 자동 허용한다. 차단 목록은 유용하지만 `rm -rf` 전체 차단은 임시 폴더 정리까지 막는다 |
| 테스트 위치 `tests/unit` · `tests/integration` | `src/tests` · `e2e` | `project.yaml` 의 `engine.test_root` 로 일부만 맞춰진다 |
| `validate-push.sh` · `validate-commit.sh` | `.github/workflows/pages.yml` | 배포 워크플로는 건드리지 않지만 커밋 검사가 CCGS 문서 형식을 요구한다 |

훅과 스크립트에서 확인한 것: 네트워크 접근은 `update-check.sh`(GitHub 릴리스 확인)와 `vendor-three.sh`(three.js 를 CDN 에서 받음, 스킬이 부를 때만) 둘이다. 프로젝트 밖에 쓰는 것은 `update-check.sh` 의 캐시 하나다. 나머지는 프로젝트 안의 파일을 읽고 검사한다. 악의적인 동작은 보지 못했다(전부 읽은 것은 아니다: 설정, 훅의 진입부, 네트워크·삭제·권한 명령을 찾아 읽었다).

## 3. 들인 것과 들이지 않은 것

| | 결정 | 이유 |
|---|---|---|
| 역할 구성(에이전트) | **들였다, 다시 썼다** | 49개 가운데 7 + 3 개의 이름과 역할 구분을 가져오고, 내용은 탐정학원의 파일 범위·기준·검수 방식으로 새로 썼다(원문의 "쓰기 전에 매번 묻기"는 뺐다) |
| `project.yaml` | **들였다** | CCGS 의 형식 그대로. `rigor: minimal`, 검수와 QA 만 올림 |
| 진행 방법 · 검수 절차 | **새로 썼다** | CCGS 의 `team-*` · `gate-check` · `smoke-check` 가 하는 일을 탐정학원의 명령과 기준으로 두 스킬에 담았다 |
| CCGS 의 스킬 78개 | 들이지 않았다 | `yaml-helper.sh` 와 CCGS 의 폴더 구조·문서 형식에 기대어 있다 |
| 훅 18개 · 스크립트 54개 | 들이지 않았다 | 위 2절. 매 도구 호출마다 도는 비용과 구조 불일치 |
| `settings.json` | 들이지 않았다 | 설정 파일을 새로 만드는 것은 권한 정책이라 사용자가 정한다(아래 제안) |
| 상태 줄 · 규칙 14개 · `CLAUDE.md` | 들이지 않았다 | 기존 `CLAUDE.md` · `DESIGN.md` 가 이미 그 일을 한다 |

**제안(적용하지 않았다)**: `main` 에 올리는 것이 곧 공개 배포이므로, 푸시를 매번 묻고 강제 푸시를 막는 설정을 `.claude/settings.json` 에 둘 수 있다. 원하면 적용한다.

```json
{
  "permissions": {
    "ask": ["Bash(git push*)"],
    "deny": ["Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push * --force*)", "Bash(git reset --hard*)"]
  }
}
```

## 4. 역할과 파일 범위

한 파일은 한 번에 한 역할만 고친다. 범위 밖의 파일은 읽기만 하고, 고칠 것은 보고에 적는다.

| 역할 | 맡는 일 | 고칠 수 있는 파일 |
|---|---|---|
| `producer` | 범위·순서·배정, 검수 게이트, 진행 기록 | `CLAUDE.md` · `README.md` · `lab/README.md` · `project.yaml` · `docs/studio/**` · `docs/archive/README.md` · `.claude/**` |
| `art-director` | 화풍, 그림 재료, 그림 검수 | `DESIGN.md` · `src/art/**` · `src/assets/**` · `src/scene/*Art.ts` · `src/iso/*Art.ts` · `src/story/art/**` · `scripts/mono-art.mjs` · `src/styles/{tokens,mono,mono-rooms,mono-pixel,pixel,pixel-rooms,art}.css` |
| `game-designer` | 퍼즐·사건의 규칙과 내용 | `PRODUCT.md`(규칙·흐름) · `src/data/{puzzles,dailySet,people}.ts` · `src/data/sets/**` · `src/story/cases/**` |
| `systems-designer` | 등급·시험·크레딧의 수치 | `src/data/ranks.ts` · `src/engine/creditEngine.ts` · `PRODUCT.md`(수치) |
| `ux-designer` | 흐름·배치·터치·문구, 사용성 검수 | `src/styles/{base,components,hall,desk,rooms,live,codeux,cases,growth,story,sound,iso}.css` |
| `gameplay-programmer` | 화면·엔진·장면 코드 | `src/app/**` · `src/screens/**` · `src/components/**` · `src/games/**` · `src/engine/**`(정책 표 제외) · `src/scene/**`(아래 두 줄 제외) · `src/iso/**`(그림 `*Art.ts` 제외) · `src/audio/**`(사운드 디자이너가 없을 때) · `src/story/{engine,scenes,components}/**` · `src/main.tsx` · `index.html` · `vite.config.ts` |
| `qa-tester` | 실제 플레이 검수, 테스트, 회귀 | `src/tests/**` · `e2e/**` · `playwright.config.ts` · `scripts/{shot,capture-all}.mjs` · `docs/screenshots/**` |
| `technical-artist` (필요할 때) | 렌더링, 외부 그래픽의 1비트 변환, 굽기 | `src/scene/{stage,dot,marks}.ts` · `src/fx/**` · `src/styles/fx.css` · `scripts/` 의 굽기 도구 · `lab/ascii/**` |
| `sound-designer` (필요할 때) | 효과음, 음악, 재생 코드 | `src/app/sound.ts` · `src/audio/**` · `public/audio/**` · `lab/audio/**` |
| `performance-analyst` (필요할 때) | 측정, 기술 비교 | `lab/perf/**` (제품 파일은 읽기만) |

- 필요할 때 부르는 역할이 없으면 그 파일은 프로듀서가 배정한 역할이 맡는다(예: `sound.ts` 를 게임플레이 프로그래머에게).
- 실험은 `lab/<이름>/` 한 폴더를 한 역할이 쓴다.
- 문구·화면 구조(TSX)를 바꾸고 싶은 UX 디자이너, 수치를 화면에 비추고 싶은 시스템 디자이너는 게임플레이 프로그래머에게 넘긴다(순서를 정한다).

## 5. 운영 방식

- **가볍게 하는 것**: 문서(기존 문서를 고쳐 쓴다), 절차(게이트 문서·스프린트 없음), 질문(승인된 범위 안에서는 묻지 않는다).
- **가볍게 하지 않는 것**: 정답 유일성, 보상 로직, 시험 정책, 모바일 UI 테스트, 실제 실행 확인, 독립 검수.
- **사용자가 정하는 것**: 제품 방향, 확정 화풍, 구조 변경, 화면·안 걷어내기, `main` 병합과 배포. 눈에 띄는 변경은 지금 것과 나란히 놓고 고르게 한다.

검수는 `playcheck` 스킬의 아홉 단계다: 개발 서버 → 실제 화면 → 직접 플레이 → 모바일 크기와 터치 → 전후 화소 비교 → 자동 테스트 → 사파리 엔진 → 독립 QA → 증거. 테스트 통과만으로 "좋아졌다"고 보고하지 않는다.

## 6. 실제로 돌려 본 것 (2026-11-22~23)

- 역할 정의는 Claude Code 의 에이전트 목록에 뜬다(세션을 이어 가는 도중에 목록에 올라왔다). 아트 디렉터 · UX 디자이너 · QA 테스터 · 게임플레이 프로그래머 · 테크니컬 아티스트를 그 이름으로 불러 일을 맡겼다.
- 한 바퀴의 모습: 구현(한 역할이 한 묶음의 파일) → 독립 검수 셋(산출물만 주고 저장소는 읽기만) → 지적을 파일 범위가 겹치지 않는 두 묶음으로 나눠 수정 → 프로듀서(주 세션)가 결과를 직접 확인하고 전체 검증을 한 번 돌린다.
- 겪은 것:
  - 여러 역할이 같은 개발 서버를 보면, 한 역할이 파일을 고치는 순간 다른 역할의 화면이 다시 읽히거나 잠깐 깨진다. 검수에는 **고정된 빌드본**(저장소 밖 폴더에 빌드해 다른 포트로 띄운 것)을 준다.
  - `npm run verify` 는 `dist/` 와 4183 포트를 쓰고 `docs/screenshots` 를 다시 쓴다. 한 번에 한 곳에서만 돌린다(역할들은 돌리지 않고, 고친 스펙만 저장소 밖의 설정으로 돌린다).
  - 스타일 파일 하나에 두 역할의 것이 섞여 있으면 나눠 맡길 수 없다(`fx.css` 에 소리 설정이 들어 있었다 → `sound.css` 로 갈랐다).
  - 검수하는 쪽은 "끝까지 보지 못한 것"을 반드시 적게 한다. 세 검수 모두 못 본 것이 있었고, 그것이 다음 확인의 목록이 됐다.

## 7. 확인하지 못한 것

- CCGS 의 스킬을 실제로 돌려 보지 않았다(들이지 않았으므로).
