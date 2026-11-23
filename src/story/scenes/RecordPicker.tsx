import { useEffect, useRef, useState } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import { EvidenceGain, NotebookLink, StoryShell, nextLabel, type SceneProps } from "../components/StoryParts";
import { sceneAfter } from "../engine/storyEngine";
import type { RecordsScene } from "../engine/storyTypes";

/**
 * 기록 고르기. 자료에 적힌 기록들 가운데 물음에 맞는 하나를 고른다.
 * 무엇과 맞대어 볼지는 수사 노트에 있다(앞 장의 증거까지): 여기서 바로 펼쳐 본다.
 * 틀린 기록을 고르면 그 기록이 아닌 까닭을 듣고 다시 고른다. 맞히면 그 기록에 딸린 증거가 열린다.
 */
export function RecordPicker(props: SceneProps & { scene: RecordsScene }) {
  const { c, ch, p, go, scene } = props;
  const records = scene.records ?? [];
  const picked = p.picked[scene.id] ?? null;
  const [choice, setChoice] = useState<string | null>(picked);
  const [line, setLine] = useState(picked ? scene.done : scene.enter);
  const [wrong, setWrong] = useState<string | null>(null);
  const [gain, setGain] = useState<string[]>([]);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const chosen = records.find((r) => r.id === choice);

  useEffect(() => {
    if (wrong) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [wrong]);

  const confirm = () => {
    if (picked) return;
    if (!choice) {
      setWrong("기록 하나를 고르세요.");
      return;
    }
    const outcome = gameStore.storyPick(c, ch, scene.id, choice);
    if (outcome.correct) {
      playSound("success");
      setWrong(null);
      setLine(outcome.reason);
      setGain(outcome.granted);
    } else {
      playSound("wrong");
      setWrong(outcome.reason);
    }
  };

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        picked ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-long={nextLabel(ch, scene.id).length > 7} onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
            {nextLabel(ch, scene.id)}
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={!!choice} data-long={!!chosen} onClick={confirm} data-testid="record-confirm">
            {chosen ? `${chosen.title} · 이 기록으로 확인` : "기록 고르기"}
          </button>
        )
      }
    >
      <div className="story__scroll">
        <section className="term picker" aria-label={scene.title} data-solved={!!picked}>
          <p className="term__bar">
            <span>{scene.title}</span>
            <span>{records.length}건</span>
          </p>
          <div className="picker__ask">
            <p data-testid="record-question">{scene.question}</p>
            <NotebookLink testId="record-notebook">수사 노트</NotebookLink>
          </div>

          <div className="term__rows" role="radiogroup" aria-label={scene.title}>
            {records.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={(picked ?? choice) === r.id}
                className="term__row picker__row"
                data-picked={picked === r.id}
                data-off={!!picked && picked !== r.id}
                disabled={!!picked}
                onClick={() => {
                  setChoice(r.id);
                  setWrong(null);
                  playSound("tick");
                }}
                data-testid={`record-${r.id}`}
              >
                <b>{r.title}</b>
                <span className="picker__lines">
                  {r.lines.map((l) => (
                    <span key={l.label}>
                      <i>{l.label}</i>
                      <span className="num">{l.value}</span>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {wrong && !picked ? (
        <p className="story__alert" ref={alertRef} role="alert" data-testid="record-wrong">
          {wrong}
        </p>
      ) : (
        <Narration text={line} />
      )}

      {gain.length > 0 && (
        <EvidenceGain
          evidence={ch.evidence.filter((e) => gain.includes(e.id))}
          onClose={() => {
            setGain([]);
            setLine(scene.done);
          }}
        />
      )}
    </StoryShell>
  );
}
