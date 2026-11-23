import { useEffect, useMemo, useRef, useState } from "react";
import { goBack, navigate } from "../app/router";
import { prefersReducedMotion } from "../app/motion";
import { playSound } from "../app/sound";
import { useGame } from "../app/store";
import { Sprite } from "../art/pixel";
import { CreditTag } from "../components/CreditReward";
import { Narration } from "../components/Narration";
import { PRACTICE_PUZZLES, practiceOfRank } from "../data/puzzles";
import { RANK_BY_ID, rankIndex, rankLabel } from "../data/ranks";
import { getProgress } from "../engine/progressEngine";
import { formatElapsed } from "../engine/time";
import type { GameState, PuzzleProgress, RankId } from "../engine/types";
import { TYPE_NAME } from "../games/logic";
import { IsoCanvas, type IsoHandle } from "../iso/IsoCanvas";
import { CABINETS, makePracticeRoom, type PracticeSpot } from "../iso/practiceRoom";

type Rank = (typeof CABINETS)[number];

/** 마지막으로 열어 본 서류함. 문제를 풀고 돌아와도 그 앞에 선다. */
let lastCabinet: Rank | null = null;

function sheetStatus(progress: PuzzleProgress): string {
  if (progress.status === "solved") return "해결";
  if (progress.status === "in_progress") return `풀이 중 ${formatElapsed(progress.elapsedMs)}`;
  return "미해결";
}

const isLocked = (game: GameState, rank: Rank) => rankIndex(rank as RankId) > rankIndex(game.rank);
const isDone = (game: GameState, rank: Rank) => practiceOfRank(rank as RankId).every((p) => getProgress(game, p.id).status === "solved");

/** 처음 설 서류함: 열려 있는 것 가운데 풀지 않은 과제가 남은 가장 낮은 등급, 없으면 지금 등급 */
function startCabinet(game: GameState): Rank {
  const open = CABINETS.filter((r) => !isLocked(game, r));
  return open.find((r) => !isDone(game, r)) ?? open[open.length - 1] ?? "F";
}

const ENTRANCE_DELAY_MS = 380;

/**
 * 연습실 · 쿼터뷰 (2026-11-23, 사용자: "나머지도 방으로"). 등급마다 서류함이 하나씩 벽을 따라 서 있다.
 * 서류함을 누르면 탐정이 그 앞으로 가고, 아래 창에 그 서류함의 과제 셋이 놓인다. 과제를 누르면 풀이로 들어간다.
 * 예전 화면(책상 위의 서랍 이름표와 과제 목록)은 ?view=side 로 열린다.
 */
export function PracticeIso() {
  const game = useGame();
  const scene = useMemo(() => makePracticeRoom(), []);
  const sceneRef = useRef<IsoHandle<PracticeSpot>>(null);
  const first = useMemo(() => lastCabinet ?? startCabinet(game), []); // eslint-disable-line react-hooks/exhaustive-deps
  /** 탐정이 선 곳과 가는 곳 */
  const [here, setHere] = useState<PracticeSpot | null>(null);
  const [heading, setHeading] = useState<PracticeSpot | null>(first);
  const leaving = useRef(false);
  const touched = useRef(false);
  const solvedTotal = PRACTICE_PUZZLES.filter((p) => getProgress(game, p.id).status === "solved").length;

  useEffect(() => {
    const id = window.setTimeout(() => !touched.current && sceneRef.current?.go(first), prefersReducedMotion() ? 0 : ENTRANCE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [first]);

  const exit = () => {
    if (leaving.current) return;
    leaving.current = true;
    goBack({ name: "home" });
  };

  const onArrive = (id: PracticeSpot) => {
    setHere(id);
    setHeading(null);
    if (id !== "door") lastCabinet = id;
  };

  /** 서류함이나 문: 걸어가서 살펴본다. 문은 그 앞에서 한 번 더 누르면 나간다. */
  const look = (id: PracticeSpot) => {
    if (leaving.current) return;
    touched.current = true;
    if (id === "door" && here === "door" && !sceneRef.current?.busy()) {
      exit();
      return;
    }
    if (here !== id) playSound("tick");
    setHere(null);
    setHeading(id);
    sceneRef.current?.go(id);
  };

  const open = (id: string) => {
    if (leaving.current) return;
    leaving.current = true;
    playSound("place");
    navigate({ name: "practice-play", id });
  };

  const selected = heading ?? here;
  const rank = selected && selected !== "door" ? selected : null;
  const locked = rank ? isLocked(game, rank) : false;
  const sheets = rank ? practiceOfRank(rank as RankId) : [];
  const solvedHere = sheets.filter((p) => getProgress(game, p.id).status === "solved").length;
  const nextId = locked ? null : (sheets.find((p) => getProgress(game, p.id).status !== "solved")?.id ?? null);
  const todo = startCabinet(game);
  const todoLeft = !isDone(game, todo);

  const line = !selected
    ? "연습실. 벽을 따라 등급마다 서류함이 서 있다."
    : selected === "door"
      ? "복도로 나가는 문."
      : locked
        ? `${rank}급 서류함. 자물쇠가 걸려 있다.`
        : solvedHere === sheets.length
          ? `${rank}급 서류함. 과제는 모두 풀었다. 다시 풀어 볼 수 있다.`
          : `${rank}급 서류함. 풀지 않은 과제가 ${sheets.length - solvedHere}개 남아 있다.`;

  return (
    <div className="screen desk inkworld practice practice--iso" data-testid="practice-room" data-view="iso" data-drawer={rank ?? ""} data-at={here ?? ""}>
      <header className="deskbar">
        <button type="button" className="tilebtn" aria-label="뒤로" onClick={exit}>
          <Sprite name="arrow-left" />
        </button>
        <div className="deskbar__tag leaf">
          <h1 className="deskbar__type">연습실</h1>
          <span className="deskbar__timer num" data-testid="practice-total">
            해결 {solvedTotal}/{PRACTICE_PUZZLES.length}
          </span>
        </div>
        <CreditTag credits={game.credits} />
      </header>

      <IsoCanvas
        ref={sceneRef}
        scene={scene}
        state={{
          locked: CABINETS.filter((r) => isLocked(game, r)),
          done: CABINETS.filter((r) => !isLocked(game, r) && isDone(game, r)),
          mark: todoLeft && selected !== todo ? todo : null,
        }}
        onArrive={onArrive}
        onLeave={() => {
          setHere(null);
          setHeading(null);
        }}
        onFloor={() => {
          touched.current = true;
          setHere(null);
          setHeading(null);
        }}
        caption={<Narration text={line} />}
      >
        {([...CABINETS, "door"] as PracticeSpot[]).map((id) => {
          const [x, y, w, h] = scene.hitRect(id);
          const [tx, ty] = scene.tagAt(id);
          const shut = id !== "door" && isLocked(game, id);
          const done = id !== "door" && !shut && isDone(game, id);
          return (
            <button
              key={id}
              type="button"
              className="isospot"
              style={{ left: x * 2, top: y * 2, width: w * 2, height: h * 2 }}
              data-on={selected === id}
              data-locked={shut}
              data-done={done}
              data-testid={id === "door" ? "practice-door" : `drawer-${id}`}
              aria-label={id === "door" ? "복도로 나가는 문" : `${id}급 서류함${shut ? ", 잠김" : done ? ", 모두 해결" : ""}`}
              onClick={() => look(id)}
            >
              <span className="isotag" style={{ left: (tx - x) * 2, top: (ty - y) * 2 }} aria-hidden="true">
                {id === "door" ? "복도" : id}
              </span>
            </button>
          );
        })}
      </IsoCanvas>

      <section className="isowin isowin--tasks">
        {rank ? (
          <div className="isocard" key={rank} data-locked={locked}>
            <p className="isocard__head">
              <span aria-hidden="true">▶</span>
              <span className="isocard__name">{rankLabel(rank as RankId)}</span>
              <span className="isocard__state num" data-testid="drawer-count">
                {locked ? "잠김" : `해결 ${solvedHere}/${sheets.length}`}
              </span>
            </p>
            {locked ? (
              <p className="isocard__shut" data-testid="drawer-locked">
                {rankLabel(rank as RankId)}에 오르면 열리는 서류함입니다. 과제 {sheets.length}개가 들어 있습니다. ({RANK_BY_ID[rank as RankId].focus})
              </p>
            ) : (
              <ol className="isotasks">
                {sheets.map((puzzle, i) => {
                  const progress = getProgress(game, puzzle.id);
                  const solved = progress.status === "solved";
                  return (
                    <li key={puzzle.id}>
                      <button
                        type="button"
                        className="isotask"
                        data-status={progress.status}
                        data-primary={puzzle.id === nextId}
                        data-testid={`practice-file-${puzzle.id}`}
                        aria-label={`연습 과제 ${i + 1}, ${puzzle.title}, ${TYPE_NAME[puzzle.type]}, 난이도 5단계 중 ${puzzle.difficulty}단계, ${sheetStatus(progress)}`}
                        onClick={() => open(puzzle.id)}
                      >
                        <span className="isotask__title">{puzzle.title}</span>
                        <span className="isotask__meta">
                          <span>{TYPE_NAME[puzzle.type]}</span>
                          <span className="num" data-testid={`practice-status-${puzzle.id}`}>
                            {solved ? "해결" : progress.status === "in_progress" ? "풀이 중" : `+${puzzle.reward}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : selected === "door" ? (
          <div className="isocard" key="door">
            <p className="isocard__head">
              <span aria-hidden="true">▶</span>
              <span className="isocard__name">복도로 나가는 문</span>
            </p>
            <button type="button" className="inkbtn inkbtn--block inkbtn--wine isocard__go" data-testid="practice-door-go" onClick={exit}>
              학원 홀로
            </button>
          </div>
        ) : (
          <div className="isowin__idle">
            <p className="isowin__hint">서류함을 누르면 그 등급의 과제가 나온다 · 처음 해결한 과제는 크레딧을 받고 승급 시험의 응시 조건에 들어간다</p>
            {todoLeft && (
              <button type="button" className="inkbtn inkbtn--block isowin__todo" data-testid="iso-todo" onClick={() => look(todo)}>
                풀지 않은 과제: {todo}급 서류함
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
