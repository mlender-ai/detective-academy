import { useEffect, useRef, useState } from "react";
import { motionMs } from "../../app/motion";
import { withTransition } from "../../app/router";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { DeskWood } from "../../components/DeskWood";
import { Stamp } from "../../components/Stamp";
import { chapterKey, logicOf } from "../cases";
import { NotebookLink, StoryShell, type SceneProps } from "../components/StoryParts";
import type { DeduceScene } from "../engine/storyTypes";

const COUNT = ["", "하나", "둘", "셋"];

/**
 * 최종 추론. 결론 하나와, 그 결론을 받치는 증거를 장면이 정한 수만큼(하나 또는 둘) 함께 낸다.
 * 결론이 맞아도 근거가 그것을 받치지 못하면 통과하지 못한다. 틀리면 결말은 열리지 않고,
 * 앞 장면으로 돌아가 다시 조사할 수 있다. 안내 글은 엔진이 돌려준 것을 그대로 보여 준다.
 */
export function FinalDeduction(props: SceneProps & { scene: DeduceScene }) {
  const { c, ch, p, go, scene } = props;
  const cleared = p.status === "cleared";
  const need = scene.need ?? 1;
  const [choice, setChoice] = useState<string | null>(p.deduction.choice);
  const [bases, setBases] = useState<string[]>(() => p.deduction.bases.filter((id) => scene.basis.includes(id)).slice(0, need));
  const ready = !!choice && bases.length === need;
  const [notice, setNotice] = useState<{ verdict: "weak" | "unsupported" | "incomplete"; text: string } | null>(null);
  const [sealed, setSealed] = useState(false);
  const timer = useRef(0);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // 알림은 아래쪽에 뜬다: 낮은 화면에서는 보이는 곳까지 올린다
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: "nearest" });
  }, [notice]);

  const basisCards = ch.evidence.filter((e) => scene.basis.includes(e.id));

  /** 근거를 고른다. 하나만 내는 장면에서는 바꿔 고르고, 여럿을 내는 장면에서는 눌러서 넣고 뺀다(수를 넘기면 먼저 고른 것이 빠진다). */
  const pickBasis = (id: string) => {
    setBases((now) => (need === 1 ? [id] : now.includes(id) ? now.filter((x) => x !== id) : [...now, id].slice(-need)));
    setNotice(null);
    playSound("tick");
  };

  const submit = () => {
    if (sealed) return;
    const basis = need === 1 ? (bases[0] ?? null) : bases;
    if (!ready || !choice || !basis) {
      // 무엇이 모자란지는 엔진이 장면의 근거 수에 맞춰 알려 준다
      setNotice({ verdict: "incomplete", text: gameStore.storyDeduce(c, ch, scene.id, choice, basis).text });
      return;
    }
    // 맞는 결론이면 인장을 찍은 뒤에 넘어간다(그 사이에는 아직 기록하지 않는다)
    if (logicOf(chapterKey(c, ch)).judgeDeduction(choice, basis, p) === "correct") {
      setNotice(null);
      setSealed(true);
      playSound("success");
      timer.current = window.setTimeout(() => withTransition(() => gameStore.storyDeduce(c, ch, scene.id, choice, basis)), motionMs(900));
      return;
    }
    const outcome = gameStore.storyDeduce(c, ch, scene.id, choice, basis);
    if (outcome.verdict === "correct") return;
    playSound("wrong");
    setNotice({ verdict: outcome.verdict, text: outcome.text });
  };

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        cleared ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => go("ending")} data-testid="story-next">
            끝 장면 보기
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={ready} disabled={sealed} onClick={submit} data-testid="deduce-submit">
            결론 제출
          </button>
        )
      }
    >
      <DeskWood />
      <div className="story__scroll">
        <section className="verdict" data-sealed={sealed || cleared} data-choices={scene.choices.length}>
          <h1 className="verdict__q">{scene.question}</h1>

          <div className="verdict__choices" role="radiogroup" aria-label="결론">
            {scene.choices.map((x, i) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={choice === x.id}
                className="verdict__choice"
                disabled={cleared || sealed}
                onClick={() => {
                  setChoice(x.id);
                  setNotice(null);
                  playSound("tick");
                }}
                data-testid={`choice-${x.id}`}
              >
                <b>{"ABCDEFGH"[i]}</b>
                <span>{x.text}</span>
              </button>
            ))}
          </div>

          <h2 className="verdict__label" data-testid="basis-label">
            근거로 내놓을 증거{need > 1 ? ` ${COUNT[need] ?? need} (${bases.length}/${need})` : ""}
          </h2>
          <div className="verdict__basis" role={need === 1 ? "radiogroup" : "group"} aria-label="근거" data-cols={basisCards.length === 4 ? 2 : 3}>
            {basisCards.map((e) => (
              <button
                key={e.id}
                type="button"
                role={need === 1 ? "radio" : "checkbox"}
                aria-checked={bases.includes(e.id)}
                className="verdict__card"
                disabled={cleared || sealed}
                onClick={() => pickBasis(e.id)}
                data-testid={`basis-${e.id}`}
              >
                <b>{e.no}</b>
                <span>{e.title}</span>
              </button>
            ))}
          </div>

          {notice && (
            <div className="verdict__notice" ref={noticeRef} role="alert" data-verdict={notice.verdict} data-testid="deduce-notice">
              <p>
                <b>{notice.verdict === "weak" ? "근거가 약합니다" : notice.verdict === "unsupported" ? "확정할 수 없는 결론입니다" : "아직 고르지 않았습니다"}</b>
                {notice.text}
              </p>
              {notice.verdict !== "incomplete" && <NotebookLink testId="deduce-review">수사 노트 다시 보기</NotebookLink>}
            </div>
          )}

          {(sealed || cleared) && (
            <div className="verdict__seal" data-now={sealed} data-testid="deduce-seal">
              <Stamp label="추론 성공" animate={sealed} size={cleared ? 72 : 112} />
            </div>
          )}
        </section>
      </div>
    </StoryShell>
  );
}
