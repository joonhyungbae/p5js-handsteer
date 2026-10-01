# NOTICE — 제3자 구성요소

이 저장소의 코드는 [LICENSE](LICENSE) 를 따릅니다. 아래 것들은 각 원저작자의 라이선스를 그대로 따릅니다.

## 저장소에 넣은 것

| 경로 | 출처 | 원저작자 | 라이선스 | 수정 여부 |
|---|---|---|---|---|
| `web/vendor/p5/p5.min.js` | https://cdn.jsdelivr.net/npm/p5@1.11.3 | Processing Foundation · p5.js Contributors | **LGPL-2.1** | 수정 없음 |
| `web/vendor/mediapipe/` | https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision | Google | **Apache-2.0** | 수정 없음 |

전시장에서 인터넷이 끊겨도 열리도록 CDN 대신 파일을 넣어 두었습니다.
**p5.js 는 LGPL-2.1 이라 고치지 않고 그대로 둡니다.** 고치면 변경 사실을 밝히고 같은 조건으로
내놓아야 합니다. 쓰는 쪽(우리 코드)은 그대로 이 저장소의 라이선스를 따릅니다.

## 설치할 때 받는 것

| 대상 | 출처 | 라이선스 | 비고 |
|---|---|---|---|
| MediaPipe Pose Landmarker 모델 (`pose_landmarker_lite.task`) | https://storage.googleapis.com/mediapipe-models/ | Apache-2.0 | 커밋하지 않는다. `python3 fetch_model.py` 가 받는다 |
| 시험용 영상 | 위키미디어 공용 | 각 파일의 표기를 따른다 | 커밋하지 않는다. `--sample` 로 받는다 |

## 파이썬 쪽

`serve.py` 는 파이썬에 들어 있는 것만 씁니다. OSC 로 내보낼 때만 `python-osc`(Unlicense)를 쓰고,
없으면 그 기능만 꺼진 채로 돌아갑니다.
