# p5js-handsteer

**카메라 앞에서 두 손을 들면 화면 속 판이 기울고 소리가 어긋납니다.** 손을 올리면 빨라지고,
한쪽 손을 내리면 그쪽으로 기웁니다. 두 손을 어깨 위로 들면 시작 신호가 켜집니다.

웹캠 한 대와 노트북, 브라우저로 돕니다. [MediaPipe](https://ai.google.dev/edge/mediapipe) 가 몸의
관절을 찾고, 그림은 [p5.js](https://p5js.org) 가 그리고, 소리는 브라우저가 냅니다. 유니티도
Processing 도 에이블톤도 켤 필요가 없습니다. 완성된 작품이 아니라 출발점이고, 바꿔 가며
자기 작품으로 만들라고 둔 예제입니다.

《2026 오픈서킷 부산: 아트앤테크 프랙티스》 멘토링 과정에서 만든 예제입니다. 참여 작가와
작업을 구상하다 공통으로 쓸 만한 뼈대가 나와, 참여자 누구나 쓸 수 있도록 공개합니다.

## 1. 깔기

터미널을 엽니다. 윈도우는 시작 메뉴에서 `PowerShell`, 맥은 `터미널`입니다.

**맥 · 리눅스**

```bash
curl -fsSL https://raw.githubusercontent.com/joonhyungbae/p5js-handsteer/main/install.sh | bash
```

**윈도우 (PowerShell)**

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
irm https://raw.githubusercontent.com/joonhyungbae/p5js-handsteer/main/install.ps1 -OutFile "$env:TEMP\install.ps1"
& "$env:TEMP\install.ps1"
```

설치가 챙기는 것: conda 환경(`handsteer`), 사람을 찾는 모델(약 6MB), 카메라 대신 써 볼 시험용 영상.
conda 가 없으면 [Miniforge](https://conda-forge.org/download/)를 사용자 폴더에 먼저 깝니다.

## 2. 켜기

```bash
./start.sh          # 맥 · 리눅스
.\start.ps1         # 윈도우
```

브라우저가 저절로 열립니다. 안 열리면 `127.0.0.1:7000` 을 칩니다. 끌 때는 <kbd>Ctrl</kbd>+<kbd>C</kbd>.

| 명령 | 하는 일 |
|---|---|
| `./start.sh` | 카메라로 켠다 |
| `./start.sh --sim` | 카메라 없이 가짜 사람으로. 손이 저절로 오르내린다 |
| `./start.sh --video sample/팔벌려뛰기.webm` | 영상 파일로 |
| `./start.sh --offline 10` | 10초를 녹화해 out 파일로 적고 끝낸다 |
| `./start.sh --host 0.0.0.0` | 폰이나 다른 컴퓨터에서 화면을 본다 |
| `./start.sh --port 7001` | 포트를 바꾼다 |

소리는 화면 왼쪽 아래 **소리 켜기**를 눌러야 납니다. 브라우저가 그렇게 막아 둡니다.

## 3. 화면에서 보는 것

- **왼쪽 큰 화면**: p5.js 가 그리는 그림. 물결이 흘러오고 판이 기웁니다
- **감지한 것**: 카메라가 본 것과 관절. 노란 점이 손목입니다
- **손에서 뽑은 숫자**: 두 손 높이차, 손 높이, 벌림, 준비 자세, 움직임
- **내보내는 조작값**: 좌우 · 세기 · 시작 · 움직임. 이 값으로 그림과 소리가 움직입니다

## 4. 바꾸는 자리

1. **`web/settings.js`** — 숫자가 전부 여기 있습니다. 조절판에서 바꾼 값은 이 파일의 처음 값에서
   시작합니다.
2. **`web/steer.js`** — 손의 무엇이 조작의 무엇이 되는지 정합니다. 한 손으로 조작하게 하거나,
   손을 모으면 멈추게 하거나, 아예 다른 몸짓으로 바꿀 수 있습니다.
3. **`web/sketch.js`** — p5.js 그림입니다. 여기를 지우고 자기 그림을 그리면 됩니다.
   Processing 에서 쓰던 코드를 거의 그대로 옮길 수 있습니다.
4. **`web/sound.js`** — 움직임이 음을 어떻게 비트는지.

고치고 브라우저를 새로 고치면 바로 보입니다. 빌드가 없습니다.

## 5. 다른 도구로 넘기기

그림과 소리를 다른 데서 만들고 싶으면 조작값만 가져가면 됩니다. 쓰지 않으면 `--osc off` 로 끕니다.

- **OSC**: `/steer/steer` · `/steer/throttle` · `/steer/ready` · `/steer/motion` (기본 127.0.0.1:7400)
- **JSON**: `http://127.0.0.1:7000/steer.json` 을 읽으면 마지막 값이 들어 있습니다

## 6. 안 될 때

| 이런 일이 생기면 | 이렇게 합니다 |
|---|---|
| 카메라가 안 열린다 | 브라우저가 카메라 권한을 물었는지 봅니다. 맥은 시스템 설정에서 크롬에 카메라를 켭니다 |
| 손을 못 잡는다 | 온몸이 화면에 들어오게 서고, 조명을 밝게 합니다. 어깨와 손목이 보여야 합니다 |
| 값이 떨린다 | 조절판에서 「무시할 흔들림」을 올리고 「따라오는 시간」을 조금 늘립니다 |
| 반응이 늦다 | 주소 뒤에 `?in=256` 을 붙여 감지 그림을 줄입니다 |
| 소리가 안 난다 | 「소리 켜기」를 눌렀는지 봅니다. 브라우저는 누르기 전에는 소리를 내지 않습니다 |
| 포트가 쓰이고 있다 | `./start.sh --port 7001` 처럼 바꿉니다 |

## 7. 더 들어가기

```text
serve.py            web/ 를 띄우고, 조작값을 받아 OSC·JSON 으로 내보낸다
web/
├── settings.js     만지는 숫자
├── sense.js        카메라에서 관절을 찾는다 (MediaPipe)
├── features.js     관절에서 손의 숫자를 뽑는다 (몸 크기로 나눠 둔다)
├── steer.js        손의 숫자를 조작값으로 바꾼다
├── sketch.js       조작값으로 그림을 그린다 (p5.js)
├── sound.js        조작값으로 소리를 비튼다
└── app.js          위의 것들을 한 프레임마다 잇는다
```

왜 이렇게 만들었는지는 [docs/notes.md](docs/notes.md). AI 도구로 고칠 때의 규칙은 [AGENTS.md](AGENTS.md).

## 쓰는 것과 라이선스

[p5.js](https://p5js.org) (LGPL-2.1) 와 [MediaPipe](https://ai.google.dev/edge/mediapipe) (Apache-2.0)
를 씁니다. 둘 다 저장소에 넣어 두어 인터넷 없이도 열립니다. 전체 목록은 [NOTICE.md](NOTICE.md).

코드는 [OpenCircuit License v1.0](LICENSE) 을 따릅니다. 오픈소스가 아니라 소스를 공개하되
쓰임을 제한합니다.

- **됩니다**: 받아서 쓰고 고치기. 이것으로 만든 **작품**은 전시하고 팔아도 허가가 필요 없습니다.
- **문의해 주세요**: 강좌나 워크숍의 교재로 쓰는 것, 코드 자체를 파는 것. <jh.bae@kaist.ac.kr>

---

<details>
<summary>English</summary>

Raise both hands in front of a webcam and the board on screen tilts; the tone detunes with it.
One hand lower turns that way, both hands up is the start signal. Webcam, laptop, browser.

```bash
curl -fsSL https://raw.githubusercontent.com/joonhyungbae/p5js-handsteer/main/install.sh | bash
cd p5js-handsteer && ./start.sh --sim
```

MediaPipe finds the joints, p5.js draws, the browser makes the sound. No Unity, no Processing,
no DAW. Two files are yours to rewrite: `web/steer.js` (what the hands mean) and `web/sketch.js`
(what gets drawn). Steering values also go out over OSC and `/steer.json` if you want to drive
something else.

Source-available, not open source: personal and artistic use is free and the works you make are
entirely yours; teaching with it or selling it needs permission ([LICENSE](LICENSE)).

</details>

<sub>《2026 오픈서킷 부산: 아트앤테크 프랙티스》에서 만든 작품 베이스라인입니다. 다른 도구는
[opencircuit](https://github.com/joonhyungbae/opencircuit)에 모여 있습니다.</sub>
