import { CineCard } from "../components/CineCard";
import { useState } from "react";
import { prefersReducedMotion } from "../app/motion";
import { playSound } from "../app/sound";
import { gameStore, useGame } from "../app/store";
import { CORRIDOR } from "../app/backdrop";
import { CoinsArt, Crest } from "../art/objects";
import { IdCard } from "../components/IdCard";
import { Stamp } from "../components/Stamp";
import { CREDIT_POLICY } from "../engine/creditEngine";
import { NICKNAME_MAX } from "../engine/progressEngine";

const ADJECTIVES = ["예리한", "침착한", "끈질긴", "조용한", "꼼꼼한", "대담한"];
const ANIMALS = ["올빼미", "여우", "까마귀", "고양이", "수달", "족제비"];

function suggestNickname(): string {
  const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

/**
 * 입학. 학원 복도 입구에서 입학 원서를 쓰면 신분증이 발급된다.
 * 첫 실행 때만 보인다.
 */
export function AdmissionScreen({ onIssue, onEnter }: { onIssue: () => void; onEnter: () => void }) {
  const game = useGame();
  const [suggested] = useState(suggestNickname);
  const [nickname, setNickname] = useState(suggested);
  // 인트로는 짧고, 화면을 누르면 바로 끝난다.
  const [introSkipped, setIntroSkipped] = useState(prefersReducedMotion);
  const issued = game.enrolled;

  const enroll = () => {
    setIntroSkipped(true);
    onIssue();
    gameStore.enroll(nickname.trim() || suggested);
    playSound("stamp");
  };

  return (
    <div
      className="screen admit inkworld"
      data-intro={introSkipped ? "skipped" : "playing"}
      data-issued={issued}
      data-testid="admission-screen"
      onPointerDown={() => setIntroSkipped(true)}
    >
      <div className="hall__scene admit__scene" aria-hidden="true">
        <img src={CORRIDOR.src} alt="" width={CORRIDOR.width} height={CORRIDOR.height} decoding="async" />
      </div>

      <header className="admit__sign">
        <Crest />
        <h1 className="admit__wordmark">
          <span>탐정학원</span>
          <span>DETECTIVE ACADEMY</span>
        </h1>
      </header>

      <div className="screen__scroll admit__scroll">
        <article className="admit__form leaf">
          <h2 className="admit__title">{issued ? "입학 허가서" : "입학 원서"}</h2>
          <p className="admit__lead" data-testid="admission-lead">
            {issued
              ? `${game.nickname} 탐정, 입학을 환영합니다. F급 견습 탐정으로 등록되었습니다.`
              : "매일 한 문제. 추리로 실력을 증명하고 탐정 등급을 올리는 곳입니다."}
          </p>

          <div className="admit__card">
            <IdCard
              nickname={game.nickname}
              rank={issued ? game.rank : null}
              detectiveNo={game.detectiveNo}
              issuedAt={game.enrolledAt}
              engrave={issued}
              nameSlot={
                issued ? undefined : (
                  <label className="idcard__input">
                    <span className="sr-only">탐정 이름</span>
                    <input
                      type="text"
                      value={nickname}
                      maxLength={NICKNAME_MAX}
                      placeholder={suggested}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      data-testid="nickname-input"
                      onChange={(event) => setNickname(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </label>
                )
              }
              overlay={issued ? <Stamp className="idcard__stamp" label="입학" size={58} animate delayMs={260} /> : undefined}
            />
          </div>

          {issued ? (
            <p className="admit__grant num" data-testid="admission-grant">
              <CoinsArt count={2} />
              수사 크레딧 {CREDIT_POLICY.initial}을 받았습니다
            </p>
          ) : (
            <p className="admit__note">이름 칸을 눌러 고쳐 쓸 수 있습니다. 나중에 신분증에서도 바꿀 수 있습니다.</p>
          )}
        </article>
      </div>

      <footer className="deskfoot">
        {issued ? (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={onEnter} data-testid="enter-academy">
            학원으로 들어가기
          </button>
        ) : (
          <button type="button" className="inkbtn inkbtn--wine deskfoot__submit" onClick={enroll} data-testid="enroll">
            입학하기
          </button>
        )}
      </footer>

      {!issued && <CineCard kicker="DETECTIVE ACADEMY" title="탐정학원" sub="야간 입학 접수" />}
    </div>
  );
}
