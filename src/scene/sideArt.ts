// 옆에서 본 학원 복도의 그림은 예전 홈과 함께 걷어냈다(V3 RELEASE · 레거시 화면 정리).
// 여기에는 장면의 그림들이 함께 쓰는 약속 하나만 남았다: 자료실 장면(vaultArt · vaultScene)과 사건의 방송 화면(src/story/art)이 가져다 쓴다.

/** 장면에 놓인 그림 한 장: 점 화면의 어디에(x, y) 무엇을(canvas) 놓는가 */
export interface Placed {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
}
