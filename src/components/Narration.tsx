import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../app/motion";

/**
 * 홈의 장면 아래에 뜨는 서술 한 줄.
 * 텍스트 어드벤처처럼 글자가 한 자씩 찍히고 끝에 네모 커서가 깜빡인다.
 * 화면 낭독기에는 찍히는 과정 없이 문장 전체를 한 번에 준다.
 */
export function Narration({ text }: { text: string }) {
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const id = window.setInterval(() => {
      setCount((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 36);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <p className="narr" data-testid="narration">
      <span className="sr-only">{text}</span>
      <span className="narr__line" aria-hidden="true">
        {/* 문장 전체로 자리를 먼저 잡아 둔다. 찍히는 동안 줄이 늘어 아래 창이 밀리지 않게 한다. */}
        <span className="narr__room">
          {text}
          <i className="narr__caret" />
        </span>
        <span className="narr__typed">
          {text.slice(0, count)}
          <i className="narr__caret" />
        </span>
      </span>
    </p>
  );
}
