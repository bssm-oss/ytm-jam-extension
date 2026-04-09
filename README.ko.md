# ytm-jam-extension

YouTube Music 동기화를 위한 Chrome extension content script입니다.

## 이 모듈이 하는 일
- WebSocket으로 sync server 연결
- 룸 `STATE`를 YouTube Music 플레이어에 반영
- 웹에서 발생한 재생/탐색/큐 변경 조작을 서버로 다시 전송

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
5. extension 아이콘 클릭 후 팝업에서 room create/join

## 룸 연결 방법
1. YouTube Music(`https://music.youtube.com`) 접속
2. extension 아이콘 클릭 후 room id 입력
3. **Create/Join** 클릭
4. 팝업에 현재 room/현재 재생곡 정보가 자동으로 표시됨
5. 곡 제어는 YouTube Music 웹 UI에서 직접 수행 (재생/탐색/큐)
6. 큐 동기화는 팝업이 아닌 YTM 네이티브 재생목록 UI 기준으로 백그라운드 적용
7. 트랙 종료 시 공유 Queue 기준으로 다음 곡(SKIP) 진행
8. 서버 엔드포인트 `wss://ytm-jam.stuckgwak.com` 접근 가능 여부 확인

## 로컬 검증 순서
1. `ytm-jam-server` 실행
2. extension 로드
3. CLI로 `play/pause/seek` 실행
4. 플레이어 동기화와 웹 조작 역전송 동작 확인

## 문제 해결
- extension 로드 실패: 빌드 후 `dist/content.js` 생성 여부 확인
- 동기화 실패: 서버 연결 가능 여부와 CLI/웹 `roomId` 일치 여부 확인
