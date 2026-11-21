// 승급 휘장을 입체로 빚는다 — Ink Studio 장면. 방패 꼴 몸통, 한 단 올라온 안쪽 면, 가운데의 둥근 돋을새김.
module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'medal',
  name: 'Rank medal',
  seed: 5,
  build(seed) {
    const palette = [0x000000, 0x202020, 0x808080, 0xf1f1ea];
    const B = makeBuilder(seed, palette);
    const S = K.sculpt(makeSculpt(B));
    const m = { r: [1, 2, 3] };
    const held = { hold: true };
    const res = 0.035;
    // 방패: 네모와, 좌우로 어긋난 큰 공 둘의 겹친 부분 → 위는 반듯하고 아래는 뾰족하게 모인다
    const shield = (z, half, r, depth) => {
      const slab = S.box([0, 1.5, z], [half, 0.95, depth], m, held);
      const left = S.ball([0.62, 1.95, z], r, m, held);
      const right = S.ball([-0.62, 1.95, z], r, m, held);
      const lens = S.join('common', left, right, held);
      S.join('common', slab, lens, { res });
    };
    shield(0, 0.92, 1.62, 0.13);
    shield(0.12, 0.7, 1.4, 0.08);
    // 가운데 돋을새김과 고리
    S.ball([0, 1.62, 0.2], [0.3, 0.3, 0.1], m, { res });
    S.torus([0, 2.55, 0], 0.16, 0.05, m, { res });
    S.bake();
    return B.finish({ cam: { target: [0, 1.3, 0], dist: 12, pitch: 0.05, yaw: 0 }, detail: 14, dither: 0, radius: 1.6 });
  }
});
