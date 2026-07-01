# Dev Notes — sprint-20260630-voice-together

## 데이터·로직 배선: 없음
순수 카피·이모지 voice 전환(킷 §4). developer 단계 불필요 — ui-publisher가 킷 JSX(SSOT) 신 voice로 정합, qa-visual 독립 검증, 리더 로직 게이트.

- DB·RPC·Edge Function·네비게이션·데이터 shape: 변경 없음.

## 변경 파일 (사용자 노출 문자열만)
- 코드 8: LoginScreen·LogListScreen·AddSheet·RoomCreatedScreen·JoinLogScreen·LogScreen·MuklogEditor·logName.
- spec 6: 위 화면 + logName + cascade(NotifSettingsScreen.spec ♥→·).
- 매핑표·이모지 결정: `ui-spec.md`.

## 이모지 결정 (킷 JSX 잔존 기준 — HANDOFF 텍스트보다 우선)
- 제거: 💕(전무), MuklogEditor 저장 토스트 🍽️.
- 유지: 빈카드 🍽️(킷 mk-home:61)·지도 폴백 🍽️·💌(초대)·🙂(익명 파트너).
- ♥→· (logName 커플 폴백, 글자만).

## S5로 이월
MemberBadge "둘이"→"N명", 작성자 라벨 "짝꿍이 기록", logName 멀티멤버 타이틀·"짝꿍" placeholder, 참여자 블록·🙂 익명 파트너 구조 = 멤버 5명 모델과 함께.

## 빌드
순수 JS 카피 → 재빌드 불필요(Metro 리로드).
