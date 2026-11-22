import { useState } from "react";
import { playSound } from "../../app/sound";
import { gameStore } from "../../app/store";
import { Narration } from "../../components/Narration";
import { PLATFORM } from "../cases/d001/case";
import { BROADCAST, MODE_TEXT, SESSIONS, SOURCE_FILE, lengthText } from "../cases/d001/logic";
import { EvidenceGain, StoryShell, type SceneProps } from "../components/StoryParts";
import { sceneAfter } from "../engine/storyEngine";
import type { RecordsScene } from "../engine/storyTypes";

/**
 * SCENE 02 · 수상한 전송 기록. 오래된 단말기에 방송 플랫폼의 서버 기록이 떠 있다.
 * 방송 화면에서 적어 온 시각을 세 줄의 전송 기록과 맞대어, 마지막 방송을 실어 보낸 기록을 고른다.
 * 틀린 기록을 고르면 그 기록이 아닌 까닭을 듣고 다시 고른다. 맞히면 그 전송에 연결된 원본 파일이 열린다.
 */
export function TransmissionLog(props: SceneProps & { scene: RecordsScene }) {
  const { c, ch, p, go, scene } = props;
  const picked = p.picked[scene.id] ?? null;
  const [choice, setChoice] = useState<string | null>(picked);
  const [line, setLine] = useState(picked ? scene.done : scene.enter);
  const [wrong, setWrong] = useState<string | null>(null);
  const [gain, setGain] = useState<string[]>([]);

  const select = (id: string) => {
    if (picked) return;
    setChoice(id);
    setWrong(null);
    playSound("tick");
  };

  const confirm = () => {
    if (!choice || picked) return;
    const outcome = gameStore.storyPick(c, ch, scene.id, choice);
    if (outcome.correct) {
      playSound("success");
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
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={() => go(sceneAfter(ch, scene.id))} data-testid="story-next">
            증거 분석으로
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" data-ready={!!choice} onClick={confirm} data-testid="record-confirm">
            {choice ? `전송 ${choice}로 확인` : "기록 고르기"}
          </button>
        )
      }
    >
      <div className="story__scroll">
        <section className="term" aria-label="서버 전송 기록" data-solved={!!picked}>
          <p className="term__bar">
            <span>{PLATFORM.code} SERVER</span>
            <span>전송 기록 조회 · {PLATFORM.channel}</span>
          </p>

          {/* 방송 화면에서 적어 온 것: 이것과 맞대어 본다 */}
          <p className="term__mine" data-testid="record-mine">
            <b>내 기록</b>
            <span className="num">
              {BROADCAST.start} → {BROADCAST.end} · {lengthText(BROADCAST.lengthSec)} · {BROADCAST.label}
            </span>
          </p>

          {!picked && (
            <ol className="term__rules" aria-label="플랫폼 규칙" data-testid="platform-rules">
              {PLATFORM.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          )}

          <div className="term__rows" role="radiogroup" aria-label="전송 기록">
            {SESSIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={(picked ?? choice) === s.id}
                className="term__row"
                data-picked={picked === s.id}
                data-off={!!picked && picked !== s.id}
                disabled={!!picked}
                onClick={() => select(s.id)}
                data-testid={`record-${s.id}`}
              >
                <b>{s.id}</b>
                <span className="num">
                  {s.start} → {s.end}
                </span>
                <span>{MODE_TEXT[s.mode]}</span>
                <span className="term__status" data-failed={s.status === "failed"}>
                  {s.status === "done" ? "완료" : "연결 실패"}
                </span>
              </button>
            ))}
          </div>

          {picked && (
            <dl className="term__file" data-testid="record-file">
              <dt>전송 {SOURCE_FILE.session}의 원본 파일</dt>
              <dd>
                <span>파일명</span>
                <b>{SOURCE_FILE.name}</b>
              </dd>
              <dd>
                <span>등록 시각</span>
                <b className="num">{SOURCE_FILE.registeredAt}</b>
              </dd>
              <dd>
                <span>영상 길이</span>
                <b className="num">{lengthText(SOURCE_FILE.lengthSec)}</b>
              </dd>
              <dd>
                <span>전송 유형</span>
                <b>예약 파일 재생</b>
              </dd>
            </dl>
          )}
        </section>
      </div>

      {wrong && !picked ? (
        <p className="story__alert" role="alert" data-testid="record-wrong">
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
