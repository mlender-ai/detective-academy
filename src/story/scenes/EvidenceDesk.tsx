import { useState } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { DeskWood } from "../../components/DeskWood";
import { StoryShell, type SceneProps } from "../components/StoryParts";
import { sceneAfter } from "../engine/storyEngine";
import type { LinkScene } from "../engine/storyTypes";

/**
 * SCENE 03 · 증거 분석. 수사 책상에 두 기록이 나란히 놓여 있다.
 * 한쪽에서 항목 하나, 다른 쪽에서 하나를 골라 잇는다. 맞대어 나오는 것이 있으면 사실로 확정되고,
 * 없으면 까닭을 듣는다(채점되지 않는다). 사실 셋이 모여도 결론은 플레이어가 따로 내려야 한다.
 */
export function EvidenceDesk(props: SceneProps & { scene: LinkScene }) {
  const { c, ch, p, go, scene } = props;
  const [left, right] = scene.docs;
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "enter" | "fact" | "known" | "none"; text: string }>({ kind: "enter", text: scene.enter });
  const [fresh, setFresh] = useState<string | null>(null);
  const found = scene.facts.filter((f) => p.facts.includes(f.id));
  const all = found.length === scene.facts.length;

  const pick = (side: "a" | "b", id: string) => {
    playSound("tick");
    if (side === "a") setA((now) => (now === id ? null : id));
    else setB((now) => (now === id ? null : id));
  };

  const link = () => {
    if (!a || !b) {
      setNote({ kind: "none", text: "두 기록에서 하나씩 골라야 맞대어 볼 수 있다." });
      return;
    }
    const outcome = gameStore.storyLink(c, ch, scene.id, a, b);
    setNote({ kind: outcome.kind, text: outcome.kind === "fact" ? `${outcome.fact.no} · ${outcome.text}` : outcome.text });
    if (outcome.kind === "fact") {
      playSound("stamp");
      setFresh(outcome.fact.id);
      setA(null);
      setB(null);
    } else {
      playSound(outcome.kind === "known" ? "tick" : "wrong");
    }
  };

  /** 이미 사실을 낸 항목인가 (그 항목은 표시해 둔다) */
  const used = (id: string) => scene.links.some((l) => (l.a === id || l.b === id) && p.facts.includes(l.fact));

  return (
    <StoryShell
      {...props}
      current={scene.id}
      foot={
        all ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
            결론 내리기
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={!!a && !!b} onClick={link} data-testid="link-items">
            두 항목 잇기
          </button>
        )
      }
    >
      <DeskWood />
      <div className="story__scroll">
        <div className="docs" data-linking={!!a && !!b}>
          {[left, right].map((doc, side) => (
            <section className="doc leaf" key={doc.id} aria-label={doc.title}>
              <h2 className="doc__title">{doc.title}</h2>
              {doc.items.map((item) => {
                const on = (side === 0 ? a : b) === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="doc__item"
                    aria-pressed={on}
                    data-used={used(item.id)}
                    data-testid={`item-${item.id}`}
                    onClick={() => pick(side === 0 ? "a" : "b", item.id)}
                  >
                    <span className="doc__label">{item.label}</span>
                    <span className="doc__value num">{item.value}</span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        <p className="docs__note" role="status" data-kind={note.kind} data-testid="link-status">
          {note.text}
        </p>

        <section className="facts" aria-label="확정한 사실">
          <h2 className="facts__title">
            확정한 사실
            <b className="num" data-testid="fact-count">
              {found.length}/{scene.facts.length}
            </b>
          </h2>
          <ol className="facts__list">
            {scene.facts.map((f) => {
              const have = p.facts.includes(f.id);
              return (
                <li key={f.id} data-have={have} data-fresh={fresh === f.id} data-testid={`fact-${f.id}`}>
                  <b>{f.no}</b>
                  <span>{have ? f.text : "아직 모른다"}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </StoryShell>
  );
}
