# Ink Studio 로 굽는 법

[Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio)(MIT, 실행 의존성 없음)는 코드로 입체를 빚어 픽셀아트로 굽는 도구다. 제품에는 넣지 않고, 그림을 굽는 데만 쓴다.

```bash
git clone --depth 1 https://github.com/siliconjungle/shapeshift-labs-ink-studio.git ~/ink-studio
```

탐정(여덟 방향 × 걷기 12장면)과 승급 휘장(16방향 회전)을 굽는다. 프로젝트 폴더에서 실행한다.

```bash
node ~/ink-studio/cli/ink-studio.js atlas lab/ink/detective.js --directions 8 --w 48 --h 72 --fps 12 --from 0 --to 1 --zoom 2 --maps normal,silhouette --out /tmp/ink-detective
```

```bash
node lab/ink/shade.mjs /tmp/ink-detective lab/gate01/assets/ink/detective-walk.png lab/gate01/assets/ink/detective-walk.json
```

```bash
node ~/ink-studio/cli/ink-studio.js atlas lab/ink/medal.js --directions 16 --w 56 --h 64 --from 0 --to 0 --zoom 2.2 --maps normal,silhouette --out /tmp/ink-medal
```

```bash
node lab/ink/shade.mjs /tmp/ink-medal lab/gate01/assets/ink/medal-turn.png lab/gate01/assets/ink/medal-turn.json view
```

- Ink Studio 는 윤곽(`silhouette.png`)과 법선(`normal.png`)을 내보낸다. 흰 점·검은 점으로 바꾸는 것은 `shade.mjs` 가 한다(법선과 빛의 각도 → 흰 점 / 격자 점묘 / 검은 점, 둘레에 흰 테).
- 장면 파일은 CommonJS 여야 해서 이 폴더에 `package.json`(`"type": "commonjs"`)을 따로 두었다.
- `--zoom` 을 주지 않으면 칸에 비해 그림이 작게 구워진다.
