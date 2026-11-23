import { useCallback, useState } from "react";
import { STORAGE_KEY } from "../../app/store";

/**
 * 화면의 펼침 상태처럼 게임 진행과는 별개인 값을 기기에 기억해 둔다.
 * 저장 칸(?save=)마다 따로 두고, 저장하지 못해도(사생활 보호 모드 등) 이번 화면에서는 그대로 쓴다.
 */
export function useStored<T>(name: string, initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void] {
  const key = `${STORAGE_KEY}:ux:${name}`;
  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  });

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const value = typeof next === "function" ? (next as (previous: T) => T)(previous) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
          // 저장 공간을 쓸 수 없어도 화면은 그대로 움직인다
        }
        return value;
      });
    },
    [key],
  );

  return [value, set];
}
