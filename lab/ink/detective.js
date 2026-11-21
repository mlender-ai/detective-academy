// 탐정 캐릭터를 입체로 빚는다 — Ink Studio(siliconjungle/shapeshift-labs-ink-studio, MIT) 장면.
// 굽는 법은 lab/ink/README.md. 여기서 나온 윤곽·법선 그림을 lab/ink/shade.mjs 가 흰 점·검은 점으로 바꾼다.
module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'detective',
  name: 'Detective',
  seed: 3,
  build(seed) {
    const palette = [0x000000, 0x202020, 0x808080, 0xf1f1ea];
    const B = makeBuilder(seed, palette);
    const S = K.sculpt(makeSculpt(B));
    const tags = K.deform.tags(S);
    const m = { r: [1, 2, 3] };
    const res = 0.04;
    // 코트: 납작한 몸통, 허리에서 밑단으로 퍼지는 자락
    S.ball([0, 2.02, 0], [0.4, 0.5, 0.27], m, { tag: 'body', res });
    S.tube([[0, 1.75, 0], [0, 0.98, 0]], 0.36, 0.56, m, { tag: 'body', res });
    S.ball([0, 2.4, 0], [0.5, 0.17, 0.27], m, { tag: 'body', res });
    // 세운 깃
    S.tube([[0, 2.44, -0.02], [0, 2.7, -0.03]], 0.2, 0.25, m, { tag: 'body', res });
    // 머리, 모자챙, 모자 꼭대기
    S.ball([0, 2.86, 0.02], 0.235, m, { tag: 'head', res });
    S.ball([0, 3.07, 0.02], [0.54, 0.04, 0.54], m, { tag: 'head', res });
    S.tube([[0, 3.08, 0.02], [0, 3.36, 0.02]], 0.28, 0.23, m, { tag: 'head', res });
    // 팔
    S.tube([[-0.5, 2.36, 0], [-0.56, 1.78, 0.02]], 0.13, 0.115, m, { tag: 'armL', res });
    S.tube([[-0.56, 1.78, 0.02], [-0.54, 1.3, 0.1]], 0.115, 0.1, m, { tag: 'armL', res });
    S.tube([[0.5, 2.36, 0], [0.56, 1.78, 0.02]], 0.13, 0.115, m, { tag: 'armR', res });
    S.tube([[0.56, 1.78, 0.02], [0.54, 1.3, 0.1]], 0.115, 0.1, m, { tag: 'armR', res });
    // 다리와 구두
    S.tube([[-0.19, 1.2, 0], [-0.19, 0.12, 0]], 0.15, 0.11, m, { tag: 'legL', res });
    S.tube([[0.19, 1.2, 0], [0.19, 0.12, 0]], 0.15, 0.11, m, { tag: 'legR', res });
    S.ball([-0.19, 0.08, 0.1], [0.14, 0.08, 0.25], m, { tag: 'legL', res });
    S.ball([0.19, 0.08, 0.1], [0.14, 0.08, 0.25], m, { tag: 'legR', res });
    S.bake();
    const W = B.finish({
      cam: { target: [0, 1.74, 0], dist: 12, pitch: 0.1, yaw: 0 },
      detail: 14,
      dither: 0,
      radius: 1.95
    });
    const k = (a) => [[0, [a, 0, 0]], [0.25, [0, 0, 0]], [0.5, [-a, 0, 0]], [0.75, [0, 0, 0]], [1, [a, 0, 0]]];
    const walk = K.anim.clip({
      dur: 1,
      loop: true,
      tracks: {
        'legL.rot': k(30),
        'legR.rot': k(-30),
        'armL.rot': k(-22),
        'armR.rot': k(22),
        'body.rot': [[0, [3, 2, 0]], [0.5, [3, -2, 0]], [1, [3, 2, 0]]]
      }
    });
    K.puppet(W, {
      parts: {
        body: { ids: tags.body, pivot: [0, 1.2, 0] },
        head: { ids: tags.head, pivot: [0, 2.62, 0], parent: 'body' },
        armL: { ids: tags.armL, pivot: [-0.5, 2.36, 0], parent: 'body' },
        armR: { ids: tags.armR, pivot: [0.5, 2.36, 0], parent: 'body' },
        legL: { ids: tags.legL, pivot: [-0.19, 1.2, 0], parent: 'body' },
        legR: { ids: tags.legR, pivot: [0.19, 1.2, 0], parent: 'body' }
      },
      pose(t, dt, puppet) {
        walk.sample(t % 1, puppet.pose);
      }
    });
    return W;
  }
});
