/**
 * 스토리(등급별 사건 수사)의 타입.
 * 사건은 자료(data)다: 장(chapter) → 장면(scene) → 조사 포인트·기록·문서·선택지. 장면의 종류(kind)마다 조작이 하나씩 있다.
 *  - timeline  : 방송 기록을 시점별로 넘겨 보며 화면의 곳곳을 조사한다
 *  - records   : 여러 기록 가운데 조건에 맞는 하나를 고른다
 *  - link      : 두 문서의 항목을 이어 사실을 확정한다
 *  - deduce    : 결론과 그 근거(하나 또는 여럿)를 함께 제출한다
 *  - compare   : 두 판(원본과 공개본)의 같은 시점을 나란히 놓고 달라진 곳을 짚는다
 *  - order     : 뒤섞인 기록을 일어난 순서대로 놓는다
 *  - testimony : 진술 하나와 기록 하나를 맞대어 모순을 찾는다
 *  - assign    : 시각 순서로 놓인 일마다 그 일을 한 사람을 넣는다
 * 새 사건은 이 조작들에 자료와 그림만 새로 얹어 만든다. 사건의 글과 판정은 cases/<id>/ 에만 둔다.
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

/**
 * 글 한 줄과, 그 글이 기대는 사실. checks 는 그 장의 점검표(ChapterLogic.checks)에서 찾는 이름이고,
 * 테스트가 그 사실들이 사건 자료에서 실제로 참인지 본다(힌트와 해설이 사실과 어긋나지 않게).
 */
export interface CheckedLine {
  text: string;
  checks: string[];
}

interface SceneBase {
  id: string;
  /** 진행 막대에 찍히는 짧은 이름 */
  step: string;
  title: string;
  /** 장면에 들어섰을 때의 서술 */
  enter: string;
  /**
   * 이 장면의 수사 지원 두 단계(비용은 문제의 힌트와 같다). 있으면 장면마다 따로 연다.
   * 없으면 장의 hints 를 쓴다(제1장).
   */
  hints?: CheckedLine[];
}

export interface TimelineScene extends SceneBase {
  kind: "timeline";
  frames: TimelineFrame[];
  points: InvestigatePoint[];
  /** 필요한 포인트를 모두 조사하면 얻는 증거 */
  grants: string;
  done: string;
}

/** 고를 수 있는 기록 한 줄 */
export interface RecordItem {
  id: string;
  title: string;
  lines: { label: string; value: string }[];
}

export interface RecordsScene extends SceneBase {
  kind: "records";
  question: string;
  /** 고를 기록들. 제1장의 전송 기록은 화면이 사건 자료에서 직접 읽으므로 비어 있다. */
  records?: RecordItem[];
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
  /** 함께 내야 하는 근거의 수. 적지 않으면 하나 */
  need?: number;
  /**
   * 결론은 맞지만 근거가 받치지 못할 때의 글 (증거 id → 글).
   * 근거가 여럿이면 내놓은 순서대로 보아, 글이 적힌 첫 증거의 글을 돌려준다(그 증거가 왜 모자란지).
   */
  weak: Record<string, string>;
}

/* ───────── 비교 (compare) ───────── */

/** 견주는 한 곳: 두 판의 값이 다르면 "달라진 곳"이다. 다른지는 값으로 판정한다(따로 적어 두지 않는다). */
export interface CompareField {
  id: string;
  label: string;
  /** 첫째 판의 값 */
  a: string;
  /** 둘째 판의 값 */
  b: string;
  /** 달라진 곳으로 맞게 짚었을 때의 서술 */
  found: string;
  /** 같은데 달라졌다고 짚었을 때의 서술 */
  same: string;
  /** 수사 노트에 적히는 글 (달라진 곳만 적힌다) */
  note: string;
}

/** 견주는 한 시점 (또는 파일 정보 같은 한 묶음) */
export interface CompareFrame {
  id: string;
  /** 시점 단추의 이름 ("00:15", "파일") */
  tab: string;
  /** 영상 안의 시각(초). 영상의 시점이 아니면 null */
  at: number | null;
  /** 화면에 놓을 그림의 이름 (사건의 그림 자료가 안다). 없으면 그림 없이 글만 */
  still?: string;
  caption: string;
  fields: CompareField[];
}

export interface CompareSide {
  id: string;
  title: string;
  sub: string;
}

export interface CompareScene extends SceneBase {
  kind: "compare";
  question: string;
  sides: [CompareSide, CompareSide];
  frames: CompareFrame[];
  /** 달라진 곳을 모두 찾으면 얻는 증거 */
  grants: string[];
  done: string;
}

/* ───────── 순서 (order) ───────── */

export interface OrderCard {
  id: string;
  label: string;
  /** 카드에 붙은 꼬리표 (자막 판, 파일 시각…) */
  tags: string[];
}

export interface OrderScene extends SceneBase {
  kind: "order";
  question: string;
  /** 화면에 적는 규칙 (지어낸 도구의 규칙) */
  rules: string[];
  /** 놓을 카드. 적힌 순서가 처음 놓이는 순서다(정답 순서가 아니다) */
  cards: OrderCard[];
  /** 순서를 맞추면 얻는 증거 */
  grants: string[];
  done: string;
}

/* ───────── 진술 대조 (testimony) ───────── */

export interface TestimonyPerson {
  id: string;
  name: string;
  role: string;
}

export interface TestimonyStatement {
  id: string;
  speaker: string;
  text: string;
  /** 기록과 어긋난 것이 드러난 뒤에 고쳐 하는 말. 참인 진술에는 없다 */
  retort?: string;
}

/** 맞대어 볼 기록 한 줄. 증거 카드 한 장이 여러 줄로 나뉠 수 있다 */
export interface TestimonyRecord {
  id: string;
  /** 이 줄이 속한 증거 */
  evidence: string;
  label: string;
  value: string;
}

export interface TestimonyScene extends SceneBase {
  kind: "testimony";
  question: string;
  people: TestimonyPerson[];
  statements: TestimonyStatement[];
  records: TestimonyRecord[];
  /** 찾아야 하는 모순의 수 (화면의 "모순 0/4". 사건의 판정으로 센 수와 같은지 테스트가 본다) */
  goal: number;
  /** 어긋나지도 받치지도 않는 짝에 붙이는 까닭 (진술|기록 → 글, 진술|* 도 된다). 없으면 기본 글 */
  misses: Record<string, string>;
  /** 모순을 모두 찾으면 얻는 증거 */
  grants: string[];
  done: string;
}

/* ───────── 배정 (assign) ───────── */

export interface AssignRow {
  id: string;
  /** 그 일이 있던 때 ("17:31", "15시경") */
  time: string;
  text: string;
}

export interface AssignOption {
  id: string;
  name: string;
}

export interface AssignScene extends SceneBase {
  kind: "assign";
  question: string;
  rows: AssignRow[];
  /** 줄마다 넣을 수 있는 것 (사람들과 "아무도 아니다") */
  options: AssignOption[];
  grants: string[];
  done: string;
}

export type StoryScene = TimelineScene | RecordsScene | LinkScene | DeduceScene | CompareScene | OrderScene | TestimonyScene | AssignScene;

export interface ChapterEnding {
  /** 한 줄씩 나오는 글 */
  lines: string[];
  /** 장이 끝나며 발견되는 기록 */
  evidence: string;
  /** 이 장의 증거로는 아직 정해지지 않는 것. claim 은 사건 논리의 주장 이름(테스트가 정말 열려 있는지 본다) */
  open: { claim: string; text: string }[];
  /** 다음 장의 번호와 제목. 마지막 장이면 null */
  next: { no: number; title: string } | null;
  /** 끝 장면에 남는 그림을 말로 적은 것 (그림은 사건의 그림 자료가 맡는다) */
  still?: string;
  /** 사건이 끝나는 장에서 마지막에 찍히는 글 ("CASE D-001 · 사건 해결") */
  closing?: string;
}

export interface StoryChapter {
  id: string;
  no: number;
  title: string;
  /** 이 장 하나의 예상 시간 ("5~8분") */
  minutes: string;
  intro: string[];
  scenes: StoryScene[];
  evidence: Evidence[];
  /** 도입을 본 순간부터 갖고 있는 증거 (학원에 도착해 있는 기록) */
  given?: string[];
  /** 장 전체의 수사 지원 두 단계(제1장). 장면마다 힌트가 있는 장은 비운다. */
  hints: string[];
  /** 해결한 뒤에 읽는 해설: 결론에 이르는 길을 차례로. 줄마다 기대는 사실을 적는다 */
  explanation?: CheckedLine[];
  /** 장을 처음 해결했을 때의 보상 */
  reward: number;
  ending: ChapterEnding;
}

/** 사건의 등장인물. 숨긴 사실은 적지 않는다(사건 접수 화면에 나와도 되는 것만) */
export interface StoryPerson {
  id: string;
  name: string;
  age: number;
  role: string;
  /** 처음 이름이 나오는 장 */
  from: number;
}

export interface StoryCase {
  id: string;
  /** "CASE D-001" */
  code: string;
  title: string;
  /** 이 등급부터 맡는다 */
  rank: RankId;
  genre: string;
  /** 사건 전체의 예상 시간 ("20~30분"). 장마다의 시간은 장에 있다 */
  totalMinutes: string;
  /** 사건 접수함에 적히는 한두 줄 */
  brief: string;
  chapters: StoryChapter[];
  /** 사건의 장 수 (사건 기록에 "전 4장" 으로 적는다) */
  plannedChapters: number;
  /**
   * 화면이 붙어 지금 열 수 있는 장의 수(앞에서부터). 비우면 전부다.
   * 자료와 판정만 있고 화면이 아직 없는 장을 홈과 사건 화면이 열지 않게 하는 문이다.
   */
  released?: number;
  /** 사건을 처음 끝까지 해결했을 때 한 번 받는 보상 (장의 보상과 따로) */
  reward?: number;
  cast?: StoryPerson[];
  /** 의뢰인 (cast 의 id) */
  client?: string;
}

/* ───────── 저장되는 진행 ───────── */

/** 한 번의 풀이에서 쌓이는 것. 끝낸 장을 다시 풀 때 이 부분만 비운다. */
export interface ChapterRun {
  /** 들어가 본 장면 */
  visited: string[];
  /** 조사한 포인트, 찾아낸 달라진 곳("시점 id.칸 id") */
  notes: string[];
  /** 확보한 증거 */
  evidence: string[];
  /** records 장면에서 맞게 고른 기록 (장면 id → 기록 id) */
  picked: Record<string, string>;
  /** 이어서 확정한 사실 */
  facts: string[];
  /** 마지막으로 낸 추론. basis 는 첫 근거, bases 는 낸 근거 전부 */
  deduction: { choice: string | null; basis: string | null; bases: string[] };
  /** order 장면에 놓아 둔 순서 (장면 id → 카드 id들) */
  placed: Record<string, string[]>;
  /** assign 장면에 넣어 둔 것 (장면 id → 줄 id → 고른 것) */
  assigned: Record<string, Record<string, string>>;
  /** testimony 장면에서 기록과 어긋난 것이 드러난 진술 */
  exposed: string[];
  /** testimony 장면에서 기록이 받친다고 확인한 진술 (알리바이) */
  verified: string[];
  /** 끝낸 장면 (compare · order · testimony · assign) */
  solved: string[];
  /** 틀린 횟수: 기록 고르기, 잘못 짚은 곳, 틀린 순서·배정, 최종 추론 */
  wrong: number;
}

export interface ChapterProgress extends ChapterRun {
  /** 지금 풀이의 상태. 끝낸 장을 다시 푸는 동안에는 in_progress 다(끝낸 적이 있는지는 archive 로 안다) */
  status: "new" | "in_progress" | "cleared";
  /** 지금 있는 곳: "intro", 장면 id, "ending", "record" */
  scene: string;
  introSeen: boolean;
  /** 장 전체의 수사 지원을 연 단계 (제1장) */
  hintsUsed: number;
  /** 장면마다의 수사 지원을 연 단계 (장면 id → 단계 수) */
  sceneHints: Record<string, number>;
  rewardClaimed: boolean;
  endingSeen: boolean;
  /** 처음 해결한 때. 다시 풀어도 바뀌지 않는다 */
  clearedAt: string | null;
  /** 끝낸 장을 다시 푸는 동안, 처음 해결했을 때의 풀이 기록(증거·사실·결론)을 여기에 둔다. 다시 풀고 있지 않으면 null */
  archive: ChapterRun | null;
}

/** 사건 하나의 진행 (장들의 진행과 따로 남기는 것) */
export interface CaseProgress {
  /** 사건을 처음 끝까지 해결한 때 */
  solvedAt: string | null;
  /** 사건 해결 보상을 받았는가 */
  rewardClaimed: boolean;
}

export interface StoryState {
  /** `${사건 id}/${장 id}` → 진행 */
  chapters: Record<string, ChapterProgress>;
  /** 사건 id → 사건의 진행. 사건을 해결하기 전에는 없다(예전 저장에도 없다) */
  cases?: Record<string, CaseProgress>;
}
