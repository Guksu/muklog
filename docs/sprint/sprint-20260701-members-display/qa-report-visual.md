# QA Report — Visual 충실도 (sprint-20260701-members-display, S5b)

판정: **PASS** (FAIL 0, 미해결=디바이스 스모크 1건) — qa-visual 에이전트. 킷 mk-log:79-103/mk-ui:272/mk-log:180-213/mk-home LogCard ↔ RN 3축 대조.

## ① 참여자 블록 (킷 mk-log:79-103 ↔ ParticipantBlock.tsx) — PASS
헤더 "참여자 N"(800/14 fg)+"· 최대 5명"(600/12 fgMuted), 멤버 행(gap16 flexWrap, 아바타46+ring, 닉 600/12 maxW50 numberOfLines1 ellipsis), 초대 버튼(members<5: dashed 원46 accentLine2px + plus20 accentStrong + "초대" 700/12) — 전 항목 킷 정합(padding·gap·폰트·토큰).
- **ring: 킷 `i===0` → RN `userId===meId`** = 링 의도(본인 강조) 재현하면서 joined_at asc 정렬에서 첫행≠나 대응 → 개선(위반 아님, ui-spec 기록).
- 배치: MuklogList header로 주입 → "우리 맛집 N" 위. 킷 흐름 일치. wish 세그 미렌더, ready만 렌더(best-effort).

## ② 로그 제목 (킷 mk-ui:272 ↔ logTitleFromMembers) — PASS
1명 "{나}의 기록"/2명 "A · B"/3명+ "A 외 N명" — 구분자·조사·공백 verbatim. name 우선·members0 폴백은 회귀 0.

## ③ 카드 제거 비주얼 — PASS
- LogCard: avatarStack 제거 → 제목+MemberBadge+시작일+chevron 좌측정렬(킷 mk-home).
- MuklogCard: 작성자 행 제거(Avatar·author import 제거), 커버/제목/별점/위치/메모 유지(킷 mk-log:180-213).

## 토큰/근사 — PASS
- 신규 토큰 3종(participantHeader 800/14·Meta 600/12·Invite 700/12) 킷 폰트스펙 정합, 색 전부 기존 토큰. 신규 raw hex 0. 인앱 액센트 블루 불변.
- 800/700→SUIT-Bold, 600→SUIT-SemiBold = muklog 전체 일관 정책(S5b 신규 편차 아님). MuklogCard glass 근사는 기존 유지(사유 인라인 기록).

## 미검증 (디바이스 스모크)
- **5명 만석 flexWrap 실제 줄바꿈**: width50×5+gap16×4=314px, 좁은 기기서 wrap. 코드상 정상이나 실기기 픽셀 미확인 → `qa-layout-blind-spot` 정책상 디바이스 스모크 권장(차단 아님).

> qa-visual 에이전트 회신을 리더가 본 파일로 보존(하네스 규칙 3).
