/*
 특징. 관절 위치에서 손으로 조작할 때 쓸 숫자만 뽑는다.

 내보내는 값은 전부 사람의 몸 크기로 나눠 둔다. 그래서 카메라에서 멀든 가깝든,
 키가 크든 작든 비슷한 숫자가 나온다. 이게 없으면 뒤로 물러서는 것만으로 값이 변한다.

   present  사람이 있나 (0 또는 1)
   tilt     두 손의 높이차. 오른손이 내려가면 +, 왼손이 내려가면 -. 대략 -1 ~ 1
   lift     두 손의 평균 높이. 어깨 높이가 0, 머리 위가 1 쯤
   spread   두 손 사이의 거리. 어깨 너비가 1
   ready    두 손을 어깨 위로 들었나 (0 또는 1)
   motion   손이 얼마나 빨리 움직이나

 어느 관절을 쓰는지는 MediaPipe 번호다. 11·12 어깨, 15·16 손목, 23·24 엉덩이.
*/

const L_SHOULDER = 11, R_SHOULDER = 12, L_WRIST = 15, R_WRIST = 16, L_HIP = 23, R_HIP = 24;
const SEEN = 0.4;   // 이보다 믿음이 낮은 관절은 못 본 것으로 친다

export class Features {
  constructor() {
    this.prev = null;
  }

  read(frame) {
    const pose = (frame.poses || [])[0];
    const out = { present: 0, tilt: 0, lift: 0, spread: 0, ready: 0, motion: 0 };
    if (!pose) {
      this.prev = null;
      return out;
    }

    const ls = pose[L_SHOULDER], rs = pose[R_SHOULDER];
    const lw = pose[L_WRIST], rw = pose[R_WRIST];
    const lh = pose[L_HIP], rh = pose[R_HIP];
    const seen = (q) => q && q.v > SEEN;
    if (!seen(ls) || !seen(rs)) return out;

    out.present = 1;

    // 몸 크기 두 가지. 어깨 너비는 좌우를, 어깨에서 엉덩이까지는 위아래를 재는 자다.
    const shoulderW = Math.max(0.04, Math.hypot(ls.x - rs.x, ls.y - rs.y));
    const shoulderY = (ls.y + rs.y) / 2;
    const hipY = seen(lh) && seen(rh) ? (lh.y + rh.y) / 2 : shoulderY + shoulderW * 1.4;
    const torso = Math.max(0.05, hipY - shoulderY);

    // 손목이 하나만 보이면 보이는 쪽만 쓴다. 한 손으로도 끊기지 않게 하려는 것이다.
    const wrists = [seen(lw) ? lw : null, seen(rw) ? rw : null];
    if (!wrists[0] && !wrists[1]) {
      this.prev = null;
      return out;
    }

    // 화면에서 위로 갈수록 y 가 작아진다. 사람 느낌에 맞게 뒤집어 둔다.
    const height = (w) => (w ? (shoulderY - w.y) / torso : 0);
    const hL = height(wrists[0]);
    const hR = height(wrists[1]);

    out.tilt = Math.max(-1.5, Math.min(1.5, hL - hR));
    // 손이 바닥까지 내려가도 값이 끝없이 커지지 않게 묶어 둔다
    const lift = wrists[0] && wrists[1] ? (hL + hR) / 2 : hL || hR;
    out.lift = Math.max(-1, Math.min(1.5, lift));
    out.spread =
      wrists[0] && wrists[1] ? Math.hypot(wrists[0].x - wrists[1].x, wrists[0].y - wrists[1].y) / shoulderW : 0;
    out.ready = wrists[0] && wrists[1] && hL > 0 && hR > 0 ? 1 : 0;

    if (this.prev) {
      const d = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);
      out.motion = Math.min(1, (d(wrists[0], this.prev[0]) + d(wrists[1], this.prev[1])) / shoulderW * 6);
    }
    this.prev = wrists;
    return out;
  }
}
