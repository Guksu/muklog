# QA Report — Visual/Copy 충실도 (sprint-20260630-voice-together)

판정: **PASS** (불일치 0, 미해결 0)

검증: 킷 JSX(SSOT) ↔ RN 사용자 노출 문자열 교차대조 + 이모지 grep 전수 + S5 경계 미변경 확인(qa-visual 에이전트). tsc 0 / 영향 스펙 197 green.

## ① 카피 정합 (킷:라인 ↔ RN:라인) — 전부 PASS
| RN | 신 문구 | 킷 SSOT |
|----|--------|---------|
| `LoginScreen.tsx:34` | 함께 다녀온 맛집을 차곡차곡 모아봐요 | mk-auth:86 |
| `LogListScreen.tsx:334·337` | {닉}님, 맛집 기록을 시작해요 / 사진·메모·위치로… 함께할 사람을 초대하세요 | mk-home:138-141 |
| `LogListScreen.tsx:370·377` | 새로 시작하고 사람을 초대해요 / 받은 초대코드로 들어가요 | mk-home:172-173 |
| `AddSheet.tsx:85·92` | (동일 두 desc) | mk-home:193-194 |
| `RoomCreatedScreen.tsx:52` | 아래 코드를 보내면 함께 기록할 수 있어요 | mk-home:276-277 |
| `JoinLogScreen.tsx:69·76` | 초대받은 로그에 들어가기 / 받은 6자리 코드를 입력하면 같은 로그에서 함께 기록해요 | mk-home:225·227 |
| `LogScreen.tsx:138·142` | 함께할 사람을 초대해요 / 이 코드를 보내면 함께 기록할 수 있어요 | mk-log voice |
| `MuklogEditor.tsx:581` | 무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요 | mk-log:453 |
| `logName.ts:71` | `${nick} · ${PARTNER}` (♥→·) | §4 |

사용자 노출 `연인/둘이/커플` 0건(grep). 잔존 `둘이`는 코드 주석·S5 멤버 로직·테스트 픽스처(비-카피).

## ② 이모지 결정 — PASS
- **💕 제거**: `grep src` 0건. EmptyLogs 히어로(`LogListScreen.tsx:356`)는 킷 mk-home:158-162의 **`+` 연결 칩**으로 재현(하트 아님) — 킷 충실.
- **🍽️ 유지**: 빈 카드 배지(`LogListScreen:147`·`MuklogList:98`, 킷 mk-home:61)·지도 폴백(`pinsToMapMarkers:11`·`nearbyCategoryEmoji:11`, 킷 mk-log:124).
- **🍽️ 제거(토스트)**: `MuklogEditor.tsx:70` 저장 토스트에서 제거(킷 mk-log:397).
- **💌 유지**(초대: AddSheet:90·EmptyLogs:375·LogScreen:136·JoinLog:66), **🙂 유지**(익명 파트너 `LogListScreen:600`). **♥ 제거** 0건.

## ③ S5 경계 미변경 — PASS (건드렸으면 FAIL)
- `MemberBadge.tsx:31` "둘이/혼자"·이모지 불변. 작성자 라벨 "짝꿍이 기록"(`MuklogCard:54`·`MuklogDetailScreen:250`) 불변. `logName` "짝꿍" placeholder·`COUPLE_FALLBACK_LABEL`·멤버수 판정 불변(♥→· 글자만). 참여자/아바타·🙂 구조 불변. → 전부 정상(S5 영역).

## 미해결 / 근사
- 없음. 순수 카피·이모지라 토큰·레이아웃·폰트 무변경(근사 항목 해당 없음).

> qa-visual 에이전트는 시스템 지침상 리포트 파일을 직접 쓰지 않아 회신을 리더가 본 파일로 보존(하네스 규칙 3).
