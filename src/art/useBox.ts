import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** 요소의 크기를 잰다 (그림을 실제 픽셀 크기로 그리기 위해) */
export function useBox<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, box];
}
