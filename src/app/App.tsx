import { useEffect, useState } from "react";
import { trackFor } from "../audio/director";
import { music } from "../audio/music";
import { AdmissionScreen } from "../screens/AdmissionScreen";
import { DailyChallenge } from "../screens/DailyChallenge";
import { DetectiveProfile } from "../screens/DetectiveProfile";
import { HomeIso } from "../screens/HomeIso";
import { PracticeIso } from "../screens/PracticeIso";
import { PracticePlay } from "../screens/PracticeRoom";
import { PromotionExam } from "../screens/PromotionExam";
import { StoryCaseScreen } from "../story/scenes/StoryCaseScreen";
import { DemoPanel, isDemoMode } from "./DemoPanel";
import { navigate, toHash, useRoute, type Route } from "./router";
import { useGame } from "./store";

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      // 홈은 쿼터뷰 학원 홀이다 (2026-11-23, 사용자: "쿼터뷰로")
      return <HomeIso />;
    case "daily":
      return <DailyChallenge />;
    case "practice":
      return <PracticeIso />;
    case "practice-play":
      return <PracticePlay id={route.id} />;
    case "exam":
      return <PromotionExam />;
    case "profile":
      return <DetectiveProfile />;
    case "story":
      return <StoryCaseScreen id={route.id} />;
  }
}

export function App() {
  const game = useGame();
  const route = useRoute();
  const [demo] = useState(isDemoMode);
  // 입학 버튼을 누른 직후에는 발급 연출을 끝까지 보여 주기 위해, 사용자가 들어갈 때까지 입학 화면에 머문다.
  const [welcoming, setWelcoming] = useState(false);

  useEffect(() => {
    if (!game.enrolled) setWelcoming(false);
  }, [game.enrolled]);

  const admitting = !game.enrolled || welcoming;

  // 배경 음악: 설정(기본 꺼짐)을 따르고, 화면에 맞는 곡으로 겹쳐 넘긴다
  const track = trackFor(route, game, admitting);
  useEffect(() => {
    music.configure(game.settings.music, game.settings.musicVolume);
  }, [game.settings.music, game.settings.musicVolume]);
  useEffect(() => {
    music.play(track);
  }, [track]);

  return (
    <div className="app">
      {admitting ? (
        <AdmissionScreen
          onIssue={() => setWelcoming(true)}
          onEnter={() => {
            setWelcoming(false);
            navigate({ name: "home" }, { replace: true });
          }}
        />
      ) : (
        <Screen key={toHash(route)} route={route} />
      )}
      {demo && <DemoPanel />}
    </div>
  );
}
