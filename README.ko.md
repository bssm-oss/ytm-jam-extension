# ytm-jam-extension

YouTube Music 동기화를 위한 Chrome extension content script입니다.

## 이 모듈이 하는 일
- WebSocket으로 sync server 연결
- 룸 `STATE`를 YouTube Music 플레이어에 반영
- 웹에서 발생한 play/pause/seek 조작을 서버로 다시 전송

## 시작 전에
- Node.js 20+
- npm
- Chrome(또는 Chromium)

## 설치 및 빌드
```bash
npm install
npm run build
```

## Chrome 로드 방법
1. `chrome://extensions` 열기
2. **개발자 모드** 활성화
3. **Load unpacked** 클릭
4. `manifest.json`이 있는 `extension/` 디렉터리 선택

## 룸 연결 방법
1. YouTube Music(`https://music.youtube.com`) 접속
2. 필요하면 URL 쿼리로 룸 지정:
```text
https://music.youtube.com/watch?v=<trackId>&ytmjamRoom=study
```
3. 서버가 `ws://localhost:3000`에서 실행 중인지 확인

## 로컬 검증 순서
1. `ytm-jam-server` 실행
2. extension 로드
3. CLI로 `play/pause/seek` 실행
4. 플레이어 동기화와 웹 조작 역전송 동작 확인

## 문제 해결
- extension 로드 실패: 빌드 후 `dist/content.js` 생성 여부 확인
- 동기화 실패: 서버 연결 가능 여부와 CLI/웹 `roomId` 일치 여부 확인
