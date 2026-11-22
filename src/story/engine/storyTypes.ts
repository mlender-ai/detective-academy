/**
 * 스토리(등급별 사건 수사)의 타입.
 * 사건은 자료(data)다: 장(chapter) → 장면(scene) → 조사 포인트·기록·문서·선택지. 장면의 종류(kind)마다 조작이 하나씩 있다.
 *  - timeline : 방송 기록을 시점별로 넘겨 보며 화면의 곳곳을 조사한다
 *  - records  : 여러 기록 가운데 조건에 맞는 하나를 고른다
 *  - link     : 두 문서의 항목을 이어 사실을 확정한다
 *  - deduce   : 결론과 그 근거를 함께 제출한다
 * 새 사건은 이 네 가지 조작에 자료와 그림만 새로 얹어 만든다.
 */
import type { RankId } from "../../engine/types";

/** "23:47" 을 분으로 */
export type Clock = `${number}:${number}`;

export type TransmitMode = "camera" | "scheduled";

/** 방송 화면에서 읽어 낸 기록 (시청자가 본 것) */
export interface BroadcastRecord {
  date: string;
  start: Clock;
  end: Clock;
  /** 영상 길이(초) */
  lengthSec: number;
  /** 화면에 붙어 있던 표시 */
  label: "LIVE";
  title: string;
}

/** 서버의 전송 기록 한 줄 */
export interface TransmitSession {
  id: string;
  start: Clock;
  end: Clock;
  mode: TransmitMode;
  status: "done" | "failed";
}

/** 가상의 방송 플랫폼이 밝힌 규칙. 실제 서비스의 정책이 아니다. */
export interface PlatformRules {
  /** 정상 종료된 방송은 시작·종료 시각이 그 전송 기록과 같다 */
  doneMatchesSession: boolean;
  /** LIVE 표시가 붙는 전송 방식 */
  liveLabelOn: TransmitMode[];
  /** 연결에 실패한 전송은 시청자에게 나가지 않는다 */
  failedNotAired: boolean;
  /** 화면에 적는 글 (순서대로) */
  text: string[];
}

/** 전송 기록에 연결된 원본 파일 */
export interface SourceFile {
  session: string;
  name: string;
  registeredAt: Clock;
  lengthSec: number;
  type: TransmitMode;
}

/** 증거: 수사 노트에 한 장씩 꽂힌다 */
export interface Evidence {
  id: string;
  no: string;
  title: string;
  /** 노트에 적히는 줄 (이름표와 값) */
  lines: { label: string; value: string }[];
  /** 덧붙이는 한 줄 */
  note?: string;
}

/* ───────── 장면 ───────── */

/** 방송 기록의 한 시점 */
export interface TimelineFrame {
  id: string;
  /** 영상 안의 시각(초) */
  at: number;
  /** 그 시점을 한 줄로 */
  caption: string;
  /** 화면에 흐르던 채팅 (닉네임, 글) */
  chat: [string, string][];
  /** 그 시각의 벽시계 ("23:47") */
  clock: Clock;
}

/** 조사 포인트: 방송 화면의 한 곳 */
export interface InvestigatePoint {
  id: string;
  /** 단추의 이름 (화면 낭독기와 노트) */
  label: string;
  /** 보이는 시점. 비우면 모든 시점 */
  frames?: string[];
  /** 화면 안의 자리(%): 왼쪽, 위, 폭, 높이 */
  area: [number, number, number, number];
  /** 조사하면 서술 한 줄에 나오는 글 */
  line: string;
  /** 수사 노트에 적히는 글 */
  note: string;
  /** 증거를 완성하는 데 꼭 필요한가 */
  required: boolean;
}

interface SceneBase {
  id: string;
  /** 진행 막대에 찍히는 짧은 이름 */
  step: string;
  title: string;
  /** 장면에 들어섰을 때의 서술 */
  enter: string;
}

export interface TimelineScene extends SceneBase {
  kind: "timeline";
  frames: TimelineFrame[];
  points: InvestigatePoint[];
  /** 필요한 포인트를 모두 조사하면 얻는 증거 */
  grants: string;
  done: string;
}

export interface RecordsScene extends SceneBase {
  kind: "records";
  question: string;
  /** 맞는 기록을 고르면 얻는 증거 */
  grants: string[];
  done: string;
}

/** 문서의 한 항목 */
export interface DocItem {
  id: string;
  label: string;
  value: string;
}

export interface LinkDoc {
  id: string;
  title: string;
  items: DocItem[];
}

export interface StoryFact {
  id: string;
  no: string;
  text: string;
}

export interface LinkRule {
  a: string;
  b: string;
  fact: string;
}

export interface LinkScene extends SceneBase {
  kind: "link";
  docs: [LinkDoc, LinkDoc];
  links: LinkRule[];
  facts: StoryFact[];
  /** 이어도 나오는 것이 없는 짝에 붙이는 까닭 (a|b → 글). 없으면 기본 글 */
  misses: Record<string, string>;
  done: string;
}

export interface DeduceChoice {
  id: string;
  text: string;
  /** 이 결론을 지금 증거로 확정할 수 없을 때 돌려주는 글 (결말은 말하지 않는다) */
  unsupported: string;
}

export interface DeduceScene extends SceneBase {
  kind: "deduce";
  question: string;
  choices: DeduceChoice[];
  /** 근거로 내놓을 수 있는 증거 */
  basis: string[];
  /** 결론은 맞지만 근거가 받치지 못할 때의 글 (증거 id → 글) */
  weak: Record<string, string>;
}

export type StoryScene = TimelineScene | RecordsScene | LinkScene | DeduceScene;

export interface ChapterEnding {
  /** 한 줄씩 나오는 글 */
  lines: string[];
  /** 장이 끝나며 발견되는 기록 */
  evidence: string;
  /** 이 장의 증거로는 아직 정해지지 않는 것. claim 은 사건 논리의 주장 이름(테스트가 정말 열려 있는지 본다) */
  open: { claim: string; text: string }[];
  /** 다음 장의 번호와 제목. 아직 만들지 않았으면 들어가는 단추는 없다. */
  next: { no: number; title: string } | null;
}

export interface StoryChapter {
  id: string;
  no: number;
  title: string;
  intro: string[];
  scenes: StoryScene[];
  evidence: Evidence[];
  /** 수사 지원(힌트) 두 단계. 비용은 문제의 힌트와 같다. */
  hints: string[];
  /** 장을 처음 해결했을 때의 보상 */
  reward: number;
  ending: ChapterEnding;
}

export interface StoryCase {
  id: string;
  /** "CASE D-001" */
  code: string;
  title: string;
  /** 이 등급부터 맡는다 */
  rank: RankId;
  genre: string;
  minutes: string;
  /** 사건 접수함에 적히는 한두 줄 */
  brief: string;
  chapters: StoryChapter[];
  /** 아직 만들지 않은 장의 수 (사건 기록에 "전 4장" 으로만 적는다) */
  plannedChapters: number;
}

/* ───────── 저장되는 진행 ───────── */

export interface ChapterProgress {
  status: "new" | "in_progress" | "cleared";
  /** 지금 있는 곳: "intro", 장면 id, "ending", "record" */
  scene: string;
  introSeen: boolean;
  /** 들어가 본 장면 */
  visited: string[];
  /** 조사한 포인트 */
  notes: string[];
  /** 확보한 증거 */
  evidence: string[];
  /** records 장면에서 맞게 고른 기록 (장면 id → 기록 id) */
  picked: Record<string, string>;
  /** 이어서 확정한 사실 */
  facts: string[];
  /** 마지막으로 낸 추론 */
  deduction: { choice: string | null; basis: string | null };
  /** 틀린 횟수: 기록 고르기 + 최종 추론 */
  wrong: number;
  hintsUsed: number;
  rewardClaimed: boolean;
  endingSeen: boolean;
  clearedAt: string | null;
}

export interface StoryState {
  /** `${사건 id}/${장 id}` → 진행 */
  chapters: Record<string, ChapterProgress>;
}
