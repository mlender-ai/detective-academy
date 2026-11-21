import { useEffect, useState } from "react";
import { AcademyHome } from "../screens/AcademyHome";
import { AdmissionScreen } from "../screens/AdmissionScreen";
import { DailyChallenge } from "../screens/DailyChallenge";
import { DetectiveProfile } from "../screens/DetectiveProfile";
import { HomePlayable } from "../screens/HomePlayable";
import { PracticePlay, PracticeRoom } from "../screens/PracticeRoom";
import { PromotionExam } from "../screens/PromotionExam";
import { DemoPanel, isDemoMode } from "./DemoPanel";
import { navigate, toHash, useRoute, type Route } from "./router";
import { useGame } from "./store";
import { HOME_VARIANT } from "./variant";

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "home":
      // 기본 홈은 플레이 가능한 복도다(GATE 02 에서 고른 B안). 예전 홈(?home=old)과 A안(?home=a)은 걷어내기 전까지 주소로만 열린다.
      return HOME_VARIANT === "b" ? <HomePlayable /> : <AcademyHome live={HOME_VARIANT === "a"} />;
    case "daily":
      return <DailyChallenge />;
    case "practice":
      return <PracticeRoom />;
    case "practice-play":
      return <PracticePlay id={route.id} />;
    case "exam":
      return <PromotionExam />;
    case "profile":
      return <DetectiveProfile />;
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
