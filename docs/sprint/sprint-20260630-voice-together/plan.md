# Sprint: voice-together (2026-06-30)

## 단일 기능
ui-design 킷 2026-06-30 델타 **§4 — 정체성 보이스 전환**: '연인/둘이' → '함께/멤버/함께할 사람', 인앱 이모지 정리. 담백·실용 + 약간 친근(해요체), 문구 안 이모지 없음.

> 출처: `HANDOFF-2026-06-30.md §4` + **킷 JSX(SSOT)** `mk-auth/mk-home/mk-log/mk-extra/mk-ui.jsx`. HANDOFF와 킷 JSX가 다르면 **킷 JSX가 단일 출처**(CLAUDE.md).

## 킷 JSX 교차확인 결과 (이모지 결정 — HANDOFF 텍스트보다 우선)
- **💕 제거** — 킷 어느 파일에도 없음. RN의 💕(EmptyLogs 히어로 하트·MuklogEditor placeholder·JoinLog 토스트) 전부 제거.
- **🍽️ 유지** — 킷 mk-home:61·mk-log:124에 **빈 카드 배지로 잔존**. → RN 빈 로그 카드 🍽️(LogListScreen:147·MuklogList:98)·지도 폴백 🍽️ **유지**. 단 **토스트의 🍽️는 제거**(MuklogEditor 저장 토스트 — §4 "토스트 이모지 제거").
- **💌 유지** — 킷 mk-home:173·194·224 초대 카드. RN 초대 UI(AddSheet·JoinLog·LogScreen 배너) 💌 유지.
- **🙂 유지** — 익명 파트너 아바타(킷 mk-home:166·mk-ui:78). (멤버 비주얼 — S5와 접점, 본 스프린트는 유지.)
- '연인'·'둘이' → 킷에 0건(전부 함께/함께할 사람/멤버).

## S4 스코프 (순수 카피 + 💕 제거 + 토스트 🍽️ 제거 — 멤버수 파생 라벨 제외)
킷 JSX의 정확한 신 문구로 정합. 주요 대상:
1. **로그인** `LoginScreen.tsx:34` LOGIN_COPY — 킷 mk-auth 신 문구("함께 다녀온 맛집을 …").
2. **EmptyLogs/온보딩** `LogListScreen.tsx` — :337 인사("둘이 다녀온…"), :369·:376 두 갈래 desc("연인을 초대해요/연인이 보낸…"), :356 💕 제거(킷 mk-home 히어로 정합).
3. **AddSheet** `:85`·`:92` desc 연인 → 함께(킷).
4. **RoomCreatedScreen** `:52` "아래 코드를 연인에게 보내면\n둘이 함께…" → 킷 "아래 코드를 보내면 함께 기록할 수 있어요".
5. **JoinLogScreen** `:69` 헤딩("연인의 로그…"→킷 "초대받은 로그에 들어가기"), `:76` 서브카피, `:42` 토스트 💕 제거.
6. **LogScreen 솔로 배너** `:138`·`:142` "연인을 초대해보세요 / …둘이 함께 기록하는 커플 로그…" → 킷 mk-log 신 문구(💌 유지).
7. **MuklogEditor** `:581` placeholder "…둘의 추억을 남겨보세요 💕"(💕 제거 + voice), `:70` SAVE_TOAST_CREATE "맛집을 기록했어요! 🍽️"(🍽️ 제거).
8. **logName** `:71` `${nick} ♥ ${PARTNER}` → `${nick} · ${PARTNER}` (♥→· 글자만, §4 명시. 구조·"짝꿍"·멤버수 로직은 S5).

> 코드 주석의 '커플/둘이/연인'(설명용)은 카피 아님 → **사용자 노출 문자열만** 변경. 주석은 무리하게 안 바꿈(혼선 시 최소 갱신).

## 명시적 비스코프 (→ S5 멤버 5명, 데이터/멤버수 모델)
- **MemberBadge** "둘이/혼자" → "N명/혼자" (§5 — 멤버수 모델 재작업).
- **작성자 라벨** "짝꿍이 기록"(MuklogCard·MuklogDetail) — author me/partner→멤버 매핑(§5).
- **logName 멀티멤버 타이틀 구조**(mkLogTitle 1/2/3+), "짝꿍" placeholder, LogScreen 참여자 블록·LogCard 아바타·MuklogCard 작성자 줄 — 전부 §5.
- **🙂 익명 파트너 아바타** — 멤버 비주얼, S5에서 참여자 블록과 함께 재정의(본 스프린트 유지).
- FoodCover 음식 이모지·샘플 UGC 메모·인앱 액센트색 불변.

## 인수조건 (TDD)
- AC1. 위 1~8 사용자 노출 문구가 킷 JSX 신 voice와 일치(연인/둘이 0건). 관련 spec(LoginScreen·LogListScreen·AddSheet·RoomCreatedScreen·JoinLogScreen·LogScreen·MuklogEditor) 기대 문자열 갱신.
- AC2. 💕 RN 전무(grep 0). MuklogEditor 저장 토스트 🍽️ 제거. **🍽️ 빈카드·💌 초대·🙂는 유지**(회귀 0).
- AC3. logName 커플 폴백이 `·` 사용(♥ 0건). 멤버수 판정 로직·"짝꿍" 불변(S5 경계).
- AC4. 비스코프(MemberBadge·작성자 라벨·참여자 구조) **미변경** 확인.
- AC5. `npm test` 전체 통과 + `npx tsc --noEmit` 0.

## 완료 기준
- AC1~5 + qa-report-visual(킷 voice 충실도·이모지 결정) + qa-report-logic(카피 회귀·경계 준수) PASS.
- 순수 JS 카피 → **재빌드 불필요**(Metro 리로드).

## 데이터 계약
- 변경 없음.
