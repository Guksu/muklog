# UI Spec — voice-together (2026-06-30)

ui-design 킷 델타 §4 — 정체성 보이스 전환('연인/둘이' → '함께/멤버/함께할 사람') + 인앱 이모지 정리.
**디자인 SSOT = 킷 JSX**(`templates/muklog/mk-*.jsx`). 순수 카피 + 💕 제거 + 토스트 🍽️ 제거. 토큰·레이아웃 무변경.

## 화면별 (킷 파일:라인 신문구) ↔ (RN 파일:라인 변경) 매핑표

| # | 대상 | 킷 SSOT | RN 파일 | old → new |
|---|------|---------|---------|-----------|
| 1 | 로그인 카피 | mk-auth.jsx:86-87 `함께 다녀온 맛집을<br/>차곡차곡 모아봐요.` | `LoginScreen.tsx:34` LOGIN_COPY | `둘이 다녀온 맛집을\n오래오래 함께 기억해요.` → `함께 다녀온 맛집을\n차곡차곡 모아봐요.` |
| 2a | EmptyLogs 인사 | mk-home.jsx:138 `맛집 기록을 시작해요` | `LogListScreen.tsx:334` | `{닉}님,\n먹로그를 시작해볼까요?` → `{닉}님,\n맛집 기록을 시작해요` |
| 2b | EmptyLogs desc | mk-home.jsx:140-141 `사진·메모·위치로 다녀온 곳을 정리하고<br/>함께할 사람을 초대하세요.` | `LogListScreen.tsx:337` | `둘이 다녀온 맛집을 사진·메모·위치로\n함께 기록하는 우리만의 지도예요.` → `사진·메모·위치로 다녀온 곳을 정리하고\n함께할 사람을 초대하세요.` |
| 2c | EmptyLogs 히어로 💕 | mk-home.jsx:158-162 (`+` 연결 칩, 하트 없음) | `LogListScreen.tsx:356` heroHeartText | `💕` → `+` (킷 연결 칩 정합) |
| 2d | EmptyLogs 시작카드1 desc | mk-home.jsx:172 `새로 시작하고 사람을 초대해요` | `LogListScreen.tsx:369` | `먼저 시작하고 연인을 초대해요` → `새로 시작하고 사람을 초대해요` |
| 2e | EmptyLogs 시작카드2 desc | mk-home.jsx:173 `받은 초대코드로 들어가요` | `LogListScreen.tsx:376` | `연인이 보낸 6자리 코드가 있어요` → `받은 초대코드로 들어가요` |
| 3a | AddSheet 카드1 desc | mk-home.jsx:193 `새로 시작하고 사람을 초대해요` | `AddSheet.tsx:85` | `먼저 시작하고 연인을 초대해요` → `새로 시작하고 사람을 초대해요` |
| 3b | AddSheet 카드2 desc | mk-home.jsx:194 `받은 초대코드로 들어가요` | `AddSheet.tsx:92` | `연인이 보낸 6자리 코드가 있어요` → `받은 초대코드로 들어가요` |
| 4 | RoomCreated desc | mk-home.jsx:276-277 `아래 코드를 보내면<br/>함께 기록할 수 있어요.` | `RoomCreatedScreen.tsx:52` | `아래 코드를 연인에게 보내면\n둘이 함께 기록할 수 있어요.` → `아래 코드를 보내면\n함께 기록할 수 있어요.` |
| 5a | JoinLog 헤딩 | mk-home.jsx:225 `초대받은 로그에 들어가기` | `JoinLogScreen.tsx:69` | `연인의 로그에 들어가기` → `초대받은 로그에 들어가기` |
| 5b | JoinLog desc | mk-home.jsx:227 `받은 6자리 코드를 입력하면<br/>같은 로그에서 함께 기록해요.` | `JoinLogScreen.tsx:76` | `연인이 보낸 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요.` → `받은 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요.` |
| 5c | JoinLog 성공 토스트 💕 | mk-home.jsx:232 `로그에 들어왔어요` | `JoinLogScreen.tsx:42` | `로그에 들어왔어요! 💕` → `로그에 들어왔어요` (§4 토스트 이모지 제거) |
| 6a | LogScreen 솔로배너 헤딩 | §4 voice (킷 mk-log 참여자 초대 톤) | `LogScreen.tsx:138` | `연인을 초대해보세요` → `함께할 사람을 초대해요` |
| 6b | LogScreen 솔로배너 desc | §4 voice + mk-home:276-277 톤 | `LogScreen.tsx:142` | `이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요.` → `이 코드를 보내면 함께 기록할 수 있어요.` |
| 7a | MuklogEditor 메모 placeholder | mk-log.jsx:453 `무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요` | `MuklogEditor.tsx:581` | `무엇을 먹었고 어땠는지, 둘의 추억을 남겨보세요 💕` → `무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요` (💕 제거 + voice) |
| 7b | MuklogEditor 저장 토스트 🍽️ | mk-log.jsx:397 `맛집을 기록했어요` | `MuklogEditor.tsx:70` SAVE_TOAST_CREATE | `맛집을 기록했어요! 🍽️` → `맛집을 기록했어요` (§4 토스트 이모지 제거) |
| 8 | logName 커플 폴백 | §4 명시(`♥`→`·` 글자만) | `logName.ts:71` | `${nick} ♥ ${PARTNER}` → `${nick} · ${PARTNER}` |

## 이모지 결정 적용 결과 (킷 JSX 교차확인 준수)

- **💕 제거(0건 확인)**: EmptyLogs 히어로(LogListScreen.tsx:356 → `+` 연결 칩, 킷 mk-home:158-162) · MuklogEditor placeholder(:581) · JoinLog 토스트(:42). `grep -rn 💕 src` = 0.
- **🍽️**: 빈 로그 카드 배지(LogListScreen.tsx:147 · MuklogList.tsx:98) · 지도 폴백(map/*) **유지**(킷 mk-home:61 · mk-log:124 잔존). **MuklogEditor 저장 토스트(:70)의 🍽️만 제거.** `grep SAVE_TOAST_CREATE 🍽️` = 0.
- **💌 유지**: AddSheet · JoinLog · LogScreen 솔로 배너 초대 카드(킷 초대 카드 잔존).
- **🙂 유지**: 익명 파트너 아바타(LogListScreen 히어로 · LogScreen 카드 겹침). 멤버 비주얼 — S5와 접점, 본 스프린트 유지.
- **♥ → · (글자 1개)**: logName 커플 폴백만. `grep -rn ♥ src` = 0.

## S5로 미룬 항목 (명시적 비스코프 — 미변경 확인)

- `MemberBadge.tsx:31` "둘이/혼자" 라벨 — memberCount 파생, S5 "N명/혼자"로 재작업.
- 작성자 라벨 "짝꿍이 기록"(MuklogCard · MuklogDetail) — author me/partner→멤버 매핑, S5.
- `logName.ts` `PARTNER_PLACEHOLDER='짝꿍'` · `COUPLE_MIN_MEMBERS` 멤버수 판정 로직 · 멀티멤버 타이틀 구조 — 불변(♥→· 글자만 변경).
- LogScreen 참여자/아바타 겹침 구조 · 🙂 익명 파트너 — 불변.
- FoodCover 음식 이모지 · 샘플 UGC 메모 · 인앱 액센트색 — 불변.

## 검증

- `npm test`: **150 suites / 1402 tests 전부 통과**.
- `npx tsc --noEmit`: **EXIT 0**.
- 회귀: 카피 cascade로 깨진 NotifSettingsScreen.spec(로그명 displayLogName 파생 `민 ♥ 짝꿍` → `민 · 짝꿍`) 동반 갱신. 그 외 회귀 0.
- 토큰/레이아웃/데이터 계약 변경 없음 — 순수 JS 카피라 재빌드 불필요(Metro 리로드).

## developer 인계 (props 계약 영향)

없음. 본 스프린트는 사용자 노출 문자열·이모지만 변경 — 컴포넌트 시그니처/props 인터페이스 불변. `displayLogName` 반환 문자열의 구분자만 `♥`→`·`(소비처 LogCard·LogScreen·NotifSettingsView는 그대로 표시만).
