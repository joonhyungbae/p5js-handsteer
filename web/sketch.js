/*
 그림. **이 파일이 작가가 고칠 두 번째 자리다.** (첫 번째는 steer.js)

 p5.js 의 WEBGL 로 그린다. 화면 전체가 셰이더 한 장이고, 조작값이 그 안의 숫자를 바꾼다.
 셰이더는 그림을 한 점 한 점 GPU 가 그리는 방식이라, 파도나 불처럼 끊임없이 흐르는 화면에 맞는다.

 받는 값(steer.js 가 만든 것)
   s.steer     좌우. -1 왼쪽, 0 가운데, 1 오른쪽
   s.throttle  세기. 0 ~ 1
   s.ready     시작 신호. 0 또는 1
   s.motion    손이 얼마나 빨리 움직이나. 0 ~ 1

 어디를 만지면 무엇이 바뀌나
   FRAG 의 fbm()        물결의 결. 숫자를 바꾸면 결이 굵거나 잘아진다
   FRAG 의 색 세 줄     바닥색 · 중간색 · 꼭대기색. 불·물·밤하늘로 바꿔 보라
   settings.js 의 조절판 거칠기 · 흐르는 속도 · 색 치우침은 코드를 고치지 않고 바꾼다

 관객이 보낸 문장은 셰이더 위에 2D 한 겹으로 올린다. 글자를 그리는 일은 words.js 가 맡고
 여기서는 그 그림판을 겹쳐 주기만 한다. 한 그림판에 모아 두어야 녹화와 사진에도 같이 담긴다.

 셰이더가 안 되는 기계도 있다. 그때는 저절로 단순한 그림으로 내려간다(drawFlat).
*/

const VERT = `
precision mediump float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  // p5 가 주는 좌표를 화면 가득 채우는 사각형으로 편다.
  // z 를 거의 맨 뒤(0.999)로 두어야 그 위에 글자를 겹칠 수 있다. 0 으로 두면 물결이 맨 앞에 선다.
  vec4 pos = vec4(aPosition.xy * 2.0 - 1.0, 0.999, 1.0);
  pos.y = -pos.y;
  gl_Position = pos;
}`;

const FRAG = `
precision mediump float;
varying vec2 vUv;

uniform float uTime;      // 흐른 시간(초)
uniform vec2  uRes;       // 화면 크기
uniform float uSteer;     // -1 ~ 1
uniform float uThrottle;  // 0 ~ 1
uniform float uReady;     // 0 또는 1
uniform float uMotion;    // 0 ~ 1
uniform float uGrain;     // 결의 거칠기
uniform float uWarm;      // 색 치우침. 0 차가운 쪽, 1 뜨거운 쪽
uniform float uBoard;     // 판 진하기. 0 이면 판 없이 물결만
uniform float uTilt;      // 판이 기운 각도(라디안)

// 값 잡음. 셰이더에서 물결과 불을 만들 때 가장 많이 쓰는 재료다.
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 잡음을 크기를 줄여 가며 여러 겹 더한다. 겹이 많을수록 결이 섬세해진다.
float fbm(vec2 p) {
  float sum = 0.0, amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * noise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 flat_uv = vec2(vUv.x, 1.0 - vUv.y);   // 화면 그대로의 자리 (판을 놓을 때 쓴다)
  vec2 uv = flat_uv;

  // 손이 기운 만큼 물결만 비스듬히 민다. 몸이 기우는 느낌이 여기서 나온다.
  uv.x += (uv.y - 0.5) * uSteer * 0.35;

  // 멀리서 가까이 흐르는 물결. 세기가 크면 빨라진다.
  float speed = 0.12 + uThrottle * 0.55;
  vec2 p = vec2(uv.x * (2.2 + uGrain * 3.0), uv.y * (3.2 + uGrain * 4.0) - uTime * speed);
  // 날이 선 결(ridged). 그냥 fbm 만 쓰면 안개처럼 퍼지고, 이렇게 하면 파도의 등이 선다.
  float base = fbm(p + fbm(p * 0.7 + uTime * 0.05) * 1.4);
  float ridge = 1.0 - abs(base * 2.0 - 1.0);
  float wave = mix(base, ridge * ridge, 0.65);

  // 아래로 갈수록 두껍게, 위로 갈수록 옅게
  float depth = pow(1.0 - uv.y, 1.6);
  float body = wave * (0.35 + depth * 1.3) + depth * 0.25;

  // 빠르게 움직이면 결이 떨린다
  body += (noise(p * 6.0 + uTime * 3.0) - 0.5) * uMotion * 0.35;

  // 색. 아래에서 위로 세 색을 섞는다. 세기가 크면 뜨거운 쪽으로 간다.
  vec3 deep  = mix(vec3(0.02, 0.06, 0.10), vec3(0.14, 0.02, 0.03), uWarm);
  vec3 mid   = mix(vec3(0.05, 0.55, 0.62), vec3(0.95, 0.25, 0.05), uWarm);
  vec3 crest = mix(vec3(0.75, 1.00, 0.95), vec3(1.00, 0.85, 0.40), uWarm);

  // 결을 또렷하게 세운다. 그냥 섞으면 안개처럼 흐려진다.
  float heat = clamp((body - 0.25) * (1.6 + uThrottle * 2.2), 0.0, 1.6);
  heat = pow(heat, 0.8);
  vec3 col = mix(deep, mid, smoothstep(0.05, 0.7, heat));
  col = mix(col, crest, smoothstep(0.7, 1.3, heat));
  // 꼭대기만 한 번 더 빛나게 (빛 번짐 흉내)
  col += crest * smoothstep(1.0, 1.5, heat) * 0.5;

  // 수평선. 세기가 크면 내려간다.
  float horizon = 0.75 - uThrottle * 0.35;
  col += vec3(0.25, 0.55, 0.5) * smoothstep(0.012, 0.0, abs(uv.y - horizon)) * 0.5;

  // 준비 신호. 가운데에서 한 번씩 퍼지는 테두리.
  if (uReady > 0.5) {
    float ring = abs(distance(uv, vec2(0.5, horizon + 0.12)) - fract(uTime * 0.6) * 0.5);
    col += vec3(0.35, 0.95, 0.85) * smoothstep(0.02, 0.0, ring) * 0.6;
  }

  // 판. 손이 어디를 가리키는지 보이게 하는 표식이다. 기울기와 높이가 조작값을 따른다.
  if (uBoard > 0.01) {
    vec2 c = vec2(0.5 + uSteer * 0.22, horizon - 0.16 + uThrottle * 0.05);
    vec2 d = flat_uv - c;
    d.x *= uRes.x / uRes.y;                       // 화면이 길어도 판이 찌그러지지 않게
    vec2 r = vec2(d.x * cos(uTilt) - d.y * sin(uTilt), d.x * sin(uTilt) + d.y * cos(uTilt));
    float e = length(vec2(r.x / 0.17, r.y / 0.016));
    vec3 boardCol = mix(vec3(0.85, 0.92, 0.90), vec3(0.55, 1.0, 0.92), uReady);
    col = mix(col, boardCol, smoothstep(1.0, 0.75, e) * uBoard);
    col += boardCol * smoothstep(1.6, 1.0, e) * 0.25 * uBoard;   // 판 둘레의 빛
  }

  // 가장자리를 어둡게 해서 화면이 떠 보이지 않게 한다
  float vig = smoothstep(1.1, 0.25, distance(flat_uv, vec2(0.5)));
  col *= vig;
  // 너무 밝은 데가 하얗게 뭉개지지 않게 눌러 준다
  col = col / (col + vec3(0.75));
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

export function startSketch(parent, getState, getParams, words = null) {
  return new p5((sk) => {
    let shader = null;
    let flat = false;       // 셰이더가 안 되면 단순한 그림으로 내려간다
    let flow = 0;
    let layer = null;       // 문장을 그리는 2D 그림판

    sk.setup = () => {
      const c = sk.createCanvas(parent.clientWidth, parent.clientHeight, sk.WEBGL);
      c.parent(parent);
      c.id("out");          // 녹화·사진 저장이 이 이름을 찾는다
      sk.noStroke();
      sk.pixelDensity(1);   // 전시용 큰 화면에서도 가볍게
      try {
        shader = sk.createShader(VERT, FRAG);
      } catch (e) {
        flat = true;
      }
      if (words) layer = sk.createGraphics(sk.width, sk.height);
    };

    sk.windowResized = () => {
      sk.resizeCanvas(parent.clientWidth, parent.clientHeight);
      layer?.resizeCanvas(sk.width, sk.height);
    };

    // 관객이 보낸 문장을 셰이더 위에 겹친다
    const overlay = (s, p) => {
      if (!layer) return;
      words.drawTo(layer.drawingContext, layer.width, layer.height, s, p);
      sk.push();
      sk.resetShader();       // 셰이더를 쓰던 채로 그리면 겹쳐지지 않는다
      sk.image(layer, -sk.width / 2, -sk.height / 2, sk.width, sk.height);
      sk.pop();
    };

    sk.draw = () => {
      const s = getState() || { steer: 0, throttle: 0, ready: 0, motion: 0 };
      const p = getParams();
      flow += (sk.deltaTime / 1000) * (0.4 + s.throttle * 2.2);

      if (!shader || flat) {
        drawFlat(sk, s, p, flow);
        overlay(s, p);
        return;
      }

      try {
        sk.shader(shader);
        shader.setUniform("uTime", sk.millis() / 1000);
        shader.setUniform("uRes", [sk.width, sk.height]);
        shader.setUniform("uSteer", s.steer);
        shader.setUniform("uThrottle", s.throttle);
        shader.setUniform("uReady", s.ready);
        shader.setUniform("uMotion", s.motion);
        shader.setUniform("uGrain", p.grain);
        shader.setUniform("uWarm", p.warm);
        shader.setUniform("uBoard", p.board);
        shader.setUniform("uTilt", (s.steer * p.boardTilt * Math.PI) / 180);
        sk.rect(-sk.width / 2, -sk.height / 2, sk.width, sk.height);
      } catch (e) {
        flat = true;        // 한 번 실패하면 그만두고 단순한 그림으로
      }

      overlay(s, p);
    };
  });
}

/* 셰이더 위에 올리는 판 */
function drawBoard(sk, s, p) {
  sk.push();
  sk.resetShader();
  sk.translate(s.steer * sk.width * 0.22, (0.1 - s.throttle * 0.15) * sk.height, 0);
  sk.rotateZ((s.steer * p.boardTilt * Math.PI) / 180);
  sk.noStroke();
  sk.fill(s.ready ? sk.color(150, 240, 220, 230) : sk.color(225, 235, 232, 150 * p.board));
  sk.ellipse(0, 0, sk.width * 0.26, Math.max(4, sk.height * 0.02));
  sk.pop();
}

/* 셰이더가 안 되는 기계에서 쓰는 단순한 그림 */
function drawFlat(sk, s, p, flow) {
  sk.resetShader();
  sk.background(13, 20, 22);
  sk.push();
  sk.translate(-sk.width / 2, -sk.height / 2);
  const horizon = sk.height * (0.75 - s.throttle * 0.35);
  sk.stroke(120, 200, 190, 90);
  sk.line(0, horizon, sk.width, horizon);
  sk.noFill();
  sk.stroke(140, 230, 210, 46);
  for (let i = 0; i < 7; i++) {
    const u = ((flow * 0.25 + i / 7) % 1) ** 2;
    const y = horizon + (sk.height - horizon) * u;
    sk.beginShape();
    for (let x = 0; x <= sk.width; x += 14) {
      sk.vertex(x, y + Math.sin(x / (sk.width * 0.08) + flow * 2 + i) * (sk.height - horizon) * 0.03 * u);
    }
    sk.endShape();
  }
  sk.pop();
  drawBoard(sk, s, p);
}
