# 부스 게임 3종

동아리 부스용 브라우저 게임 모음입니다. 설치 없이 Chrome에서 바로 실행됩니다.

| 번호 | 게임 | 조작 |
|---|---|---|
| 1 | 과일 받기 | `←` `→` (또는 `A` `D`) |
| 2 | 우주 방위대 | 방향키 이동, 총은 자동, `Space` 폭탄 |
| 3 | 2인 대전 | 1P `W` `A` `S` `D` + `F` / 2P 방향키 + `Enter` (`0` 컴퓨터와 대전) |

## 실행
- **온라인**: https://bmcmon.github.io/booth-games/ 에서 바로 플레이
- **오프라인(부스)**: 저장소를 내려받아 `index.html`을 Chrome으로 열고 `F11`

운영자 단축키·키보드 점검·난이도 조정은 [README.txt](README.txt)를 보세요.

## 구성
외부 라이브러리·이미지·소리 파일 없이 캔버스 도형과 Web Audio만 사용합니다.

```
index.html    게임 고르기
core.js       공통 기능 (화면·입력·소리·순위·운영자 키)
fruit.html    과일 받기
shooter.html  우주 방위대
versus.html   2인 대전
keytest.html  키 동시 입력 테스트
```

순위는 브라우저(localStorage)에 저장되며 서버로 보내지 않습니다.
