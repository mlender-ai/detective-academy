import { useEffect, useRef, useState } from "react";
import { haptic, playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import { Silhouette } from "../art/castArt";
import { StoryShell, nextLabel, type SceneProps } from "../components/StoryParts";
import { assignedOf, sceneAfter, sceneDone } from "../engine/storyEngine";
import type { AssignScene } from "../engine/storyTypes";

/**
 * 타임라인 세우기. 시각 순서로 놓인 일마다 그 일을 한 사람을 넣는다.
 * 줄을 고르고(처음에는 맨 위의 빈 줄이 골라져 있다) 아래의 이름표를 누르면 그 줄에 들어가고, 다음 빈 줄로 넘어간다.
 * 채워진 줄은 눈금이 차고 줄이 이어져, 하루가 위에서부터 서 가는 것이 보인다. 넣어 둔 것은 저장된다.
 * 모두 넣고 내면 채점한다: 기록과 어긋나는 줄이 표시되고 첫 줄의 까닭을 듣는다(누가 맞는지는 듣지 못한다).
 */
export function DayTimeline(props: SceneProps & { scene: AssignScene }) {
  const { c, ch, p, go, scene } = props;
  const done = sceneDone(p, scene);
  const assigned = assignedOf(p, scene);
  const firstEmpty = (from = 0, now = assigned) => {
    const rows = [...scene.rows.slice(from), ...scene.rows.slice(0, from)];
    return rows.find((row) => !now[row.id])?.id ?? null;
  };
  const [cursor, setCursor] = useState<string | null>(() => firstEmpty());
  const [flagged, setFlagged] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [line, setLine] = useState(done ? scene.done : scene.enter);
  const filled = scene.rows.filter((row) => assigned[row.id]).length;
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 고른 줄이 보이는 곳에 오게 한다 (낮은 화면에서는 줄들이 스크롤된다)
  useEffect(() => {
    if (cursor) rowRefs.current[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const put = (optionId: string) => {
    if (done || !cursor) return;
    const clear = assigned[cursor] === optionId;
    gameStore.storyAssign(c, ch, scene.id, cursor, clear ? null : optionId);
    playSound(clear ? "tick" : "place");
    haptic(8);
    setWrong(null);
    setFlagged((now) => now.filter((id) => id !== cursor));
    if (clear) return;
    // 다음 빈 줄로 넘어간다. 빈 줄이 없으면 그 줄에 머문다(다시 고쳐 넣을 수 있게)
    const at = scene.rows.findIndex((row) => row.id === cursor);
    const next = firstEmpty(at + 1, { ...assigned, [cursor]: optionId });
    if (next) setCursor(next);
  };

  const submit = () => {
    const outcome = gameStore.storySubmitAssign(c, ch, scene.id);
    if (outcome.verdict === "correct") {
      playSound("success");
      setFlagged([]);
      setWrong(null);
      setCursor(null);
      setLine(scene.done);
      return;
    }
    playSound("wrong");
    haptic(30);
    setFlagged(outcome.rows);
    setWrong(outcome.reason);
    if (outcome.rows[0]) setCursor(outcome.rows[0]);
  };

  const nameOf = (id: string | undefined) => scene.options.find((o) => o.id === id)?.name ?? null;

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        done ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-long={nextLabel(ch, scene.id).length > 7} onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
            {nextLabel(ch, scene.id)}
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={filled === scene.rows.length} onClick={submit} data-testid="assign-submit">
            타임라인 확인
          </button>
        )
      }
    >
      <div className="story__scroll">
        <section className="day" aria-label={scene.title} data-solved={done} data-testid="assign">
          <p className="olog__bar">
            <span>{scene.question}</span>
            <span className="num" data-testid="assign-tally">
              {filled}/{scene.rows.length}
            </span>
          </p>
          <ol className="day__rows">
            {scene.rows.map((row) => {
              const who = assigned[row.id];
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="day__row"
                    ref={(el) => {
                      rowRefs.current[row.id] = el;
                    }}
                    aria-pressed={cursor === row.id}
                    aria-label={`${row.time} ${row.text}: ${nameOf(who) ?? "비어 있음"}${flagged.includes(row.id) ? " (기록과 어긋남)" : ""}`}
                    data-filled={!!who}
                    data-flagged={flagged.includes(row.id)}
                    disabled={done}
                    onClick={() => {
                      playSound("tick");
                      setCursor(row.id);
                    }}
                    data-testid={`row-${row.id}`}
                    data-who={who ?? ""}
                  >
                    <span className="day__time num">{row.time}</span>
                    <span className="day__who">{nameOf(who) ?? "?"}</span>
                    <span className="day__text">{row.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {!done && (
        <div className="day__picks" role="group" aria-label="이 줄에 넣을 사람">
          {scene.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="day__pick"
              aria-pressed={!!cursor && assigned[cursor] === option.id}
              disabled={!cursor}
              onClick={() => put(option.id)}
              data-testid={`pick-${option.id}`}
            >
              <Silhouette id={option.id} />
              <span>{option.name}</span>
            </button>
          ))}
        </div>
      )}

      {wrong && !done ? (
        <p className="story__alert" role="alert" data-testid="assign-wrong">
          {wrong}
        </p>
      ) : (
        <Narration text={line} />
      )}
    </StoryShell>
  );
}
