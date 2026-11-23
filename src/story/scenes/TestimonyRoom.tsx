import { useEffect, useRef, useState } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { DeskWood } from "../../components/DeskWood";
import { Silhouette } from "../art/castArt";
import { EvidenceGain, StoryShell, nextLabel, type SceneProps } from "../components/StoryParts";
import { sceneAfter, sceneDone } from "../engine/storyEngine";
import type { ConfrontOutcome } from "../engine/storyEngine";
import type { TestimonyScene } from "../engine/storyTypes";

type Note = { kind: "enter" | ConfrontOutcome["kind"] | "pick"; text: string };

const VERDICT: Record<ConfrontOutcome["kind"], string> = {
  contradiction: "어긋난다",
  known: "이미 찾은 어긋남",
  supports: "기록과 맞는다",
  nothing: "말해 주는 것이 없다",
};

/**
 * 진술 대조. 위에는 진술한 사람들이 나란히 서 있고(실루엣과 이름표), 고른 사람의 진술이 한 장씩 말풍선에 뜬다.
 * 아래에는 확인된 기록이 줄마다 놓여 있다. 진술 하나와 기록 한 줄을 골라 맞대어 본다(채점하지 않는 조사다):
 * 어긋나면 그 진술이 깨지고 고쳐 하는 말이 나오며, 기록이 진술을 받치면 그렇다고 적히고, 아무것도 아니면 까닭을 듣는다.
 * 어긋나는 진술을 모두 찾으면 장면이 끝난다. 누가 거짓말을 했는지는 결론이 아니다(결론은 최종 추론에서 따로 낸다).
 */
export function TestimonyRoom(props: SceneProps & { scene: TestimonyScene }) {
  const { c, ch, p, go, scene } = props;
  const done = sceneDone(p, scene);
  const [speaker, setSpeaker] = useState(scene.people[0].id);
  const mine = scene.statements.filter((s) => s.speaker === speaker);
  const [statementId, setStatementId] = useState(mine[0].id);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [note, setNote] = useState<Note>({ kind: "enter", text: done ? scene.done : scene.enter });
  const [gain, setGain] = useState<string[]>([]);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const statement = scene.statements.find((s) => s.id === statementId) ?? mine[0];
  const found = scene.statements.filter((s) => p.exposed.includes(s.id)).length;
  const broken = p.exposed.includes(statement.id);
  const backed = p.verified.includes(statement.id);

  useEffect(() => {
    if (note.kind !== "enter") noteRef.current?.scrollIntoView({ block: "nearest" });
  }, [note]);

  const choose = (personId: string) => {
    if (personId === speaker) return;
    playSound("tick");
    setSpeaker(personId);
    setStatementId(scene.statements.find((s) => s.speaker === personId)!.id);
  };

  const confront = () => {
    if (!recordId) {
      setNote({ kind: "pick", text: "맞대어 볼 기록 한 줄을 고르세요." });
      return;
    }
    const outcome = gameStore.storyConfront(c, ch, scene.id, statement.id, recordId);
    setNote({ kind: outcome.kind, text: outcome.text });
    if (outcome.kind === "contradiction") {
      playSound("stamp");
      setRecordId(null);
      if (outcome.granted.length > 0) setGain(outcome.granted);
    } else if (outcome.kind === "supports") {
      playSound("place");
    } else {
      playSound(outcome.kind === "known" ? "tick" : "wrong");
    }
  };

  const markOf = (id: string) => (p.exposed.includes(id) ? "broken" : p.verified.includes(id) ? "backed" : "open");

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
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={!!recordId} onClick={confront} data-testid="confront">
            맞대어 보기
          </button>
        )
      }
    >
      <DeskWood />
      <div className="story__scroll">
        <div className="witness" role="tablist" aria-label="진술한 사람">
          {scene.people.map((person) => {
            const said = scene.statements.filter((s) => s.speaker === person.id);
            return (
              <button key={person.id} type="button" role="tab" className="witness__tab" aria-selected={person.id === speaker} onClick={() => choose(person.id)} data-testid={`person-${person.id}`}>
                <Silhouette id={person.id} />
                <span className="witness__name">{person.name}</span>
                <span className="witness__role">{person.role}</span>
                <span className="witness__marks" aria-label={`진술 ${said.length}개 가운데 어긋남 ${said.filter((s) => p.exposed.includes(s.id)).length}개`}>
                  {said.map((s) => (
                    <i key={s.id} data-mark={markOf(s.id)} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <section className="talk" data-mark={markOf(statement.id)} aria-label={`${scene.people.find((x) => x.id === speaker)?.name}의 진술`} data-testid="statement" data-statement={statement.id}>
          <div className="talk__pick" role="radiogroup" aria-label="진술 고르기">
            <span className="talk__who">진술</span>
            {mine.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === statement.id}
                aria-label={`${i + 1}번째 진술`}
                className="talk__chip num"
                data-mark={markOf(s.id)}
                onClick={() => {
                  playSound("tick");
                  setStatementId(s.id);
                }}
                data-testid={`statement-${s.id}`}
              >
                {i + 1}
              </button>
            ))}
            {(broken || backed) && <em className="talk__tag">{broken ? "기록과 어긋남" : "기록과 맞음"}</em>}
          </div>
          <p className="talk__text" data-testid="statement-text">
            “{statement.text}”
          </p>
          {broken && statement.retort && (
            <p className="talk__retort" data-testid="statement-retort">
              {statement.retort}
            </p>
          )}
        </section>

        <section className="recs" aria-label="확인된 기록">
          <h2 className="recs__title">
            <span>{scene.question}</span>
            <b className="num" data-testid="confront-tally" data-done={done}>
              {found}/{scene.goal}
            </b>
          </h2>
          <div className="recs__grid" role="radiogroup" aria-label="맞대어 볼 기록">
            {scene.records.map((record) => (
              <button
                key={record.id}
                type="button"
                role="radio"
                aria-checked={recordId === record.id}
                className="recs__item"
                onClick={() => {
                  playSound("tick");
                  setRecordId(recordId === record.id ? null : record.id);
                }}
                data-testid={`rec-${record.id}`}
              >
                <span className="doc__label">{record.label}</span>
                <span className="doc__value num">{record.value}</span>
              </button>
            ))}
          </div>
        </section>

        <p className="docs__note" ref={noteRef} role="status" data-kind={note.kind === "contradiction" ? "fact" : note.kind} data-testid="confront-status">
          {note.kind !== "enter" && note.kind !== "pick" && <b>{VERDICT[note.kind]} · </b>}
          {note.text}
        </p>
      </div>

      {gain.length > 0 && (
        <EvidenceGain
          evidence={ch.evidence.filter((e) => gain.includes(e.id))}
          onClose={() => {
            setGain([]);
            setNote({ kind: "enter", text: scene.done });
          }}
        />
      )}
    </StoryShell>
  );
}
