/*
 감지. 카메라에 비친 사람의 실루엣과 관절 위치.

 매 프레임 내보내는 것은 두 가지뿐이다.

   mask   GW×GH 칸의 0~1 값. 1 에 가까울수록 사람 몸이다. 여러 사람이면 합친다
   poses  사람마다 관절 33개 {x, y, v}. x·y 는 화면 비율(0~1), v 는 믿을 만한 정도

 카메라가 없으면 「가짜 사람」으로 돌린다. 색면 쪽을 장비 없이 만들어 보려고 둔 것이다.
 실루엣은 MediaPipe Pose Landmarker 가 뽑는다(Apache-2.0). 인터넷에서 아무것도 불러오지 않는다.
*/

import { GRID_W, GRID_H, INPUT_WIDTH, MAX_PEOPLE } from "./settings.js";

export const GW = GRID_W;
export const GH = GRID_H;

// 사람을 찾는 그림의 크기. 클수록 정확하고 느리다. 라즈베리파이에서 느리면 주소에 ?in=256 처럼 줄인다.
const IN_W = Math.max(128, Math.min(640, Number(new URLSearchParams(location.search).get("in")) || INPUT_WIDTH));
const IN_H = Math.round((IN_W * 3) / 4);

async function exists(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

// 라이브러리는 저장소에 들어 있고(web/vendor/mediapipe), 모델은 설치할 때 web/models/ 에 받는다.
// 둘 다 index.html 기준 경로다. 이 파일(sense.js) 기준으로 부르면 다른 곳을 찾는다.
const LIB = new URL("vendor/mediapipe", document.baseURI).href;
const MODEL = new URL("models/pose_landmarker_lite.task", document.baseURI).href;

async function loadLandmarker(numPoses, say) {
  if (!(await exists(MODEL))) {
    throw new Error("사람을 찾는 모델이 없습니다. 터미널에서 python3 fetch_model.py 를 한 번 실행하세요");
  }
  say("MediaPipe 를 여는 중");
  const vision = await import(`${LIB}/vision_bundle.mjs`);
  const fileset = await vision.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numPoses,
    outputSegmentationMasks: false,   // 이 예제는 관절만 쓴다. 켜면 느려진다
  });
  // 기본은 CPU 다. GPU 로 돌리면 관절은 잡히는데 실루엣이 비어 나오는 기계가 있었다.
  // 주소에 ?gpu 를 붙이면 GPU 로 해 본다. 실루엣이 붉게 안 칠해지면 다시 빼면 된다.
  const how = new URLSearchParams(location.search).has("gpu") ? "GPU" : "CPU";
  return { lm: await vision.PoseLandmarker.createFromOptions(fileset, options(how)), how };
}

/* 카메라나 영상 파일에서 실루엣을 뽑는다. */
export class CameraSense {
  constructor(video, { numPoses = MAX_PEOPLE, file = null, deviceId = null, camLabel = null, say = () => {} } = {}) {
    this.video = video;
    this.numPoses = numPoses;
    this.file = file;
    this.deviceId = deviceId;
    this.camLabel = camLabel;
    this.say = say;
    this.source = file ? "영상 파일" : "카메라";
    this.input = document.createElement("canvas");
    this.input.width = IN_W;
    this.input.height = IN_H;
    this.ictx = this.input.getContext("2d", { willReadFrequently: true });
    this.frame = { mask: new Float32Array(GW * GH), poses: [], image: this.input };
    this.fps = 0;
    this._last = 0;
    this._lastTs = -1;
  }

  async start() {
    if (this.file) {
      // 고른 파일이거나 ?video= 로 준 주소다
      this.video.src = typeof this.file === "string" ? this.file : URL.createObjectURL(this.file);
      this.video.loop = true;
      this.video.muted = true;
    } else {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("이 브라우저에서는 카메라를 열 수 없습니다. 주소가 localhost 이거나 https 여야 합니다");
      }
      const video = { width: 640, height: 480 };
      if (this.deviceId) video.deviceId = { exact: this.deviceId };
      this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      // ?cam=USB 처럼 이름 일부를 주면 그 카메라로 바꾼다. 이름은 권한을 받은 뒤에야 보인다.
      if (this.camLabel && !this.deviceId) {
        const want = this.camLabel.toLowerCase();
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        const hit = cams.find((d) => d.label.toLowerCase().includes(want));
        const now = this.video.srcObject.getVideoTracks()[0]?.getSettings().deviceId;
        if (hit && hit.deviceId !== now) {
          this.video.srcObject.getTracks().forEach((t) => t.stop());
          video.deviceId = { exact: hit.deviceId };
          this.video.srcObject = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        }
        this.source = hit ? `카메라: ${hit.label}` : `카메라 (「${this.camLabel}」를 찾지 못해 기본 카메라)`;
      }
    }
    await this.video.play();
    const { lm, how } = await loadLandmarker(this.numPoses, this.say);
    this.lm = lm;
    this.note = `MediaPipe · ${how} · 입력 ${IN_W}×${IN_H}`;
  }

  stop() {
    const s = this.video.srcObject;
    if (s) s.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.lm?.close();
  }

  /* 새 프레임이 있으면 감지해서 this.frame 을 갈아 끼운다. */
  read(now) {
    const v = this.video;
    if (!this.lm || v.readyState < 2) return this.frame;
    // 영상 시간이 그대로면 같은 그림이다. 다시 볼 필요가 없다.
    if (v.currentTime === this._lastTs && !this.file) return this.frame;
    this._lastTs = v.currentTime;

    // 화면 비율이 달라도 가운데를 4:3 으로 잘라 넣는다.
    const vw = v.videoWidth, vh = v.videoHeight;
    const want = IN_W / IN_H;
    let sw = vw, sh = vh;
    if (vw / vh > want) sw = vh * want;
    else sh = vw / want;
    this.ictx.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, IN_W, IN_H);

    this.lm.detectForVideo(this.input, now, (res) => {
      const mask = new Float32Array(GW * GH);
      for (const m of res.segmentationMasks || []) {
        const src = m.getAsFloat32Array();
        const sx = m.width / GW, sy = m.height / GH;
        for (let y = 0; y < GH; y++) {
          const row = Math.floor(y * sy) * m.width;
          for (let x = 0; x < GW; x++) {
            const val = src[row + Math.floor(x * sx)];
            const i = y * GW + x;
            if (val > mask[i]) mask[i] = val;
          }
        }
      }
      const poses = (res.landmarks || []).map((pts) =>
        pts.map((p) => ({ x: p.x, y: p.y, v: p.visibility ?? 1 }))
      );
      this.frame = { mask, poses, image: this.input };
    });

    const dt = now - this._last;
    if (dt > 0) this.fps = this.fps * 0.9 + (1000 / dt) * 0.1;
    this._last = now;
    return this.frame;
  }
}

/* 가짜 사람. 카메라 없이 색면을 만들어 보려고 둔다. 걸어 다니고 팔을 든다. */
export class SimSense {
  constructor({ people = 1 } = {}) {
    this.source = "가짜 사람";
    this.note = "카메라 없이 막대 인형이 움직이는 중";
    this.people = people;
    // 미리보기에 크게 보이므로 격자(128×96)보다 크게 그린다. 흐려 보이지 않게.
    this.W = 384;
    this.H = 288;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.fps = 60;
    this.frame = { mask: new Float32Array(GW * GH), poses: [], image: this.canvas };
  }

  async start() {}
  stop() {}

  /* t 초일 때 한 사람의 관절 자리. 화면 비율 0~1.

     이 예제의 가짜 사람은 두 손을 따로 올렸다 내린다. 그래야 카메라 없이도 조작값이
     움직이는 것을 볼 수 있다. 두 손의 주기를 다르게 두어 높이차(좌우 기울기)도 생긴다. */
  static figure(t, k) {
    const x = 0.5 + 0.06 * Math.sin(t * 0.21 + k);         // 제자리에서 조금 흔들린다
    const s = 0.8;                                          // 거리는 고정. 손만 본다
    const top = 0.5 - 0.42 * s;
    const P = (dx, dy) => ({ x: x + dx * s, y: top + dy * s, v: 1 });

    // 두 손의 높이. 0 이면 허리, 1 이면 머리 위.
    const both = 0.5 + 0.5 * Math.sin(t * 0.33 + k);
    const apart = 0.35 * Math.sin(t * 0.7 + k * 1.3);
    const hL = Math.max(0, Math.min(1.1, both + apart));
    const hR = Math.max(0, Math.min(1.1, both - apart));
    const arm = (h) => ({ elbow: 0.36 - 0.16 * h, wrist: 0.46 - 0.44 * h, out: 0.13 + 0.12 * h });
    const aL = arm(hL), aR = arm(hR);
    const swing = Math.sin(t * 2.1 + k) * 0.02;

    const pts = new Array(33).fill(null).map(() => P(0, 0.3));
    pts[0] = P(0, 0.08);                                            // 코
    pts[11] = P(-0.09, 0.2); pts[12] = P(0.09, 0.2);                // 어깨
    pts[13] = P(-aL.out, aL.elbow); pts[14] = P(aR.out, aR.elbow);  // 팔꿈치
    pts[15] = P(-aL.out - 0.1, aL.wrist); pts[16] = P(aR.out + 0.1, aR.wrist); // 손목
    pts[23] = P(-0.06, 0.5); pts[24] = P(0.06, 0.5);                // 엉덩이
    pts[25] = P(-0.07 + swing, 0.68); pts[26] = P(0.07 - swing, 0.68);
    pts[27] = P(-0.08, 0.86); pts[28] = P(0.08, 0.86);
    return { pts, s, sh: 0.14 };
  }

  read(now) {
    const t = now / 1000;
    const c = this.ctx;

    // 바탕. 위가 어둡고 아래가 조금 밝은 밤빛. 대시보드 색과 맞춘다.
    const W = this.W, H = this.H;
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0b1214");
    sky.addColorStop(1, "#15201f");
    c.fillStyle = sky;
    c.fillRect(0, 0, W, H);

    // 바닥선 하나. 사람이 떠 있어 보이지 않게 한다.
    c.strokeStyle = "rgba(120,200,190,0.18)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, H * 0.88);
    c.lineTo(W, H * 0.88);
    c.stroke();

    c.lineCap = c.lineJoin = "round";
    const poses = [];

    for (let k = 0; k < this.people; k++) {
      const { pts, s: scale } = SimSense.figure(t, k);
      const s = scale * 3;   // 캔버스가 커진 만큼 선도 굵게
      const X = (p) => p.x * W, Y = (p) => p.y * H;

      // 발밑 그림자
      const feet = (Y(pts[27]) + Y(pts[28])) / 2;
      const mid = (X(pts[23]) + X(pts[24])) / 2;
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.beginPath();
      c.ellipse(mid, feet + 2 * s, 13 * s, 3 * s, 0, 0, Math.PI * 2);
      c.fill();

      const limb = (a, b, w) => {
        c.lineWidth = w * s;
        c.beginPath();
        c.moveTo(X(pts[a]), Y(pts[a]));
        c.lineTo(X(pts[b]), Y(pts[b]));
        c.stroke();
      };

      // 몸통. 테두리 없이 부드러운 덩어리로 둔다.
      c.fillStyle = "rgba(190,214,210,0.92)";
      c.strokeStyle = "rgba(190,214,210,0.92)";
      c.beginPath();
      c.moveTo(X(pts[11]), Y(pts[11]));
      c.lineTo(X(pts[12]), Y(pts[12]));
      c.lineTo(X(pts[24]), Y(pts[24]));
      c.lineTo(X(pts[23]), Y(pts[23]));
      c.closePath();
      c.lineWidth = 7 * s;
      c.fill();
      c.stroke();

      // 머리
      c.beginPath();
      c.arc(X(pts[0]), Y(pts[0]), 6 * s, 0, Math.PI * 2);
      c.fill();

      // 다리는 굵게, 팔은 가늘게
      for (const [a, b] of [[23, 25], [25, 27], [24, 26], [26, 28]]) limb(a, b, 7);
      c.strokeStyle = "rgba(205,226,222,0.95)";
      for (const [a, b] of [[11, 13], [13, 15], [12, 14], [14, 16]]) limb(a, b, 5);

      // 손목. 이 예제가 보는 자리라 따로 표시한다.
      for (const i of [15, 16]) {
        c.fillStyle = "rgba(255,210,122,0.95)";
        c.beginPath();
        c.arc(X(pts[i]), Y(pts[i]), 3.4 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,210,122,0.25)";
        c.beginPath();
        c.arc(X(pts[i]), Y(pts[i]), 6.5 * s, 0, Math.PI * 2);
        c.fill();
      }

      poses.push(pts);
    }

    // 실루엣 값. 이 예제는 쓰지 않지만 모양을 맞춰 둔다. 큰 그림을 격자 크기로 줄여서 읽는다.
    if (!this.small) {
      this.small = document.createElement("canvas");
      this.small.width = GW;
      this.small.height = GH;
      this.smallCtx = this.small.getContext("2d", { willReadFrequently: true });
    }
    this.smallCtx.drawImage(this.canvas, 0, 0, GW, GH);
    const px = this.smallCtx.getImageData(0, 0, GW, GH).data;
    const mask = new Float32Array(GW * GH);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] / 255;
    this.frame = { mask, poses, image: this.canvas };
    return this.frame;
  }
}
