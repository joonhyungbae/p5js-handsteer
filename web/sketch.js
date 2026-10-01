/*
 그림. **이 파일이 작가가 고칠 두 번째 자리다.** (첫 번째는 steer.js)

 p5.js 로 그린다. 조작값을 받아 화면을 그리는 일만 한다. 감지도 소리도 여기서 하지 않는다.

 받는 값(steer.js 가 만든 것)
   s.steer     좌우. -1 왼쪽, 0 가운데, 1 오른쪽
   s.throttle  세기. 0 ~ 1
   s.ready     시작 신호. 0 또는 1
   s.motion    손이 얼마나 빨리 움직이나. 0 ~ 1

 지금은 물결이 흘러오고 판이 기우는 정도만 그린다. 여기를 지우고 자기 그림을 그리면 된다.
 p5.js 는 Processing 의 자바스크립트 판이라 그리는 방식이 같다. Processing 에서 쓰던 코드를
 거의 그대로 옮길 수 있고, 옮기고 나면 Processing 을 따로 켤 일이 없다.

 다른 도구(유니티·터치디자이너·에이블톤)로 넘기고 싶을 때만 serve.py 가 내보내는
 OSC 나 /steer.json 을 쓴다. 쓰지 않으면 꺼도 된다(./start.sh --osc off).
*/

export function startSketch(parent, getState, getParams) {
  // p5 는 전역 변수 p5 로 들어온다(index.html 에서 vendor/p5/p5.min.js 를 먼저 읽는다).
  return new p5((sk) => {
    let flow = 0;

    sk.setup = () => {
      const c = sk.createCanvas(parent.clientWidth, parent.clientHeight);
      c.parent(parent);
      c.id("out");                 // 녹화·사진 저장이 이 이름을 찾는다
      sk.noStroke();
    };

    sk.windowResized = () => sk.resizeCanvas(parent.clientWidth, parent.clientHeight);

    sk.draw = () => {
      const s = getState() || { steer: 0, throttle: 0, ready: 0, motion: 0 };
      const p = getParams();
      const W = sk.width, H = sk.height;
      flow += (sk.deltaTime / 1000) * (0.4 + s.throttle * 2.2);   // 세기가 크면 빨리 흐른다

      // 바탕
      sk.background(13, 20, 22);

      // 수평선. 세기가 크면 내려간다
      const horizon = H * (0.75 - s.throttle * 0.35);
      sk.stroke(120, 200, 190, 90);
      sk.strokeWeight(Math.max(1, H / 500));
      sk.line(0, horizon, W, horizon);

      // 좌우로 흐르는 세로선
      sk.stroke(120, 200, 190, 30);
      sk.strokeWeight(1);
      for (let i = 0; i <= 10; i++) {
        const x = (W / 10) * i + s.steer * W * 0.08;
        sk.line(x, horizon, W / 2 + (x - W / 2) * 2.4, H);
      }

      // 흘러오는 물결
      sk.stroke(140, 230, 210, 46);
      sk.noFill();
      for (let i = 0; i < 7; i++) {
        const u = ((flow * 0.25 + i / 7) % 1) ** 2;
        const y = horizon + (H - horizon) * u;
        const amp = (H - horizon) * 0.03 * u;
        sk.beginShape();
        for (let x = 0; x <= W; x += 12) {
          sk.vertex(x, y + sk.sin(x / (W * 0.08) + flow * 2 + i) * amp);
        }
        sk.endShape();
      }

      // 판. 좌우가 기울기, 세기가 높이
      const cx = W / 2 + s.steer * W * 0.22;
      const cy = horizon + (H - horizon) * (0.45 - s.throttle * 0.15);
      sk.push();
      sk.translate(cx, cy);
      sk.rotate((s.steer * p.boardTilt * Math.PI) / 180);
      sk.noStroke();
      sk.fill(s.ready ? sk.color(140, 230, 210) : sk.color(200, 210, 208, 150));
      sk.ellipse(0, 0, W * 0.28, Math.max(4, H * 0.024));
      sk.fill(255, 255, 255, 60 + s.motion * 120);
      sk.rect(-W * 0.14, 0, W * 0.28, Math.max(2, H * 0.004) + s.motion * H * 0.02);
      sk.pop();

      if (s.ready) {
        sk.noStroke();
        sk.fill(140, 230, 210);
        sk.textAlign(sk.CENTER);
        sk.textSize(Math.round(H * 0.045));
        sk.text("준비", W / 2, H * 0.14);
      }
    };
  });
}
