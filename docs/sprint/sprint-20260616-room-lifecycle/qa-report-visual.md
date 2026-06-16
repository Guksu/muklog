# QA Report — Visual (room-lifecycle)

> **기준: 킷 비종속** (plan §0/§4·D7, ui-spec §0). 킷 `templates/muklog`에 나가기/예약삭제/취소 UI 없음 → 킷 라인 대조가 아니라 **기존 muklog 패턴·토큰 정합**으로 검증(visual-qa 스킬 3축 적용).
> 검증자: qa-visual · 일자: 2026-06-16 · 코드 수정 없음(검증·리포트만).
> 대상: `ScheduledDeletionBanner.tsx` · `LeaveLogSheets.tsx` · `tokens.ts`(negativeWeak).
> 참고: 전체 tsc 3건(profileStats 픽스처)은 developer MyLog 확장 건 — 비주얼 판정엔 비차단(ui-spec §6).

## 요약 — ✅ 비주얼 완료(패턴 정합)

| 구분 | 건수 |
|---|---|
| **PASS** | 16 (presentational 12 + 통합 4) |
| **FAIL** | 0 |
| **PENDING** | 0 |

➡️ **두 presentational 컴포넌트·토큰·LogScreen 통합 = 전부 통과.** ui-publisher 수정 요청 없음.
- 1차(presentational+토큰): 12 PASS — 아래 ①②③.
- 2차(통합 재검증, developer 배선 #23 완료·1094 green/tsc 0 후): 4 PASS — 아래 ④.
- **room-lifecycle 비주얼 충실도 = 완료(패턴 정합 기준).**

---

## ① 레이아웃·구조

| # | 항목 | 패턴 출처 ↔ RN | 판정 |
|---|---|---|---|
| 1 | ⋯ 메뉴 시트 = 단일 danger 행 | `MuklogDetailScreen.tsx:442-467`(MenuRow) ↔ `LeaveLogSheets.tsx:65-75` | **PASS** — 공용 `Sheet`(title 없음) + `MenuRow` 단일 행, 동일 구조 |
| 2 | 확인 시트 = 본문 + (에러) + danger + ghost 수직 | `MuklogDetailScreen.tsx:469-515` ↔ `LeaveLogSheets.tsx:78-131` | **PASS** — `Sheet`(title=분기) → 본문 → 인라인 에러 → `gap:10` 액션 스택. 구조 1:1 |
| 3 | 배너 = 약톤 카드 가로행(아이콘+메시지+액션) | SoloInviteBanner 약톤 카드 `LogScreen.tsx:118-142` + CompactInviteRow 행 `:99-114` ↔ `ScheduledDeletionBanner.tsx:41-67` | **PASS** — 약톤 카드(weak bg·`radius.sheet`·padding) 베이스에 가로 액션행 채택(메시지 `flex:1`, 우측 `Button`). ui-spec §1(L30·31) 의도와 일치 |

---

## ② 비주얼·토큰

| # | 항목 | 패턴 출처 ↔ RN | 판정 |
|---|---|---|---|
| 4 | MenuRow danger 치수 | `MuklogDetailScreen.tsx:520-552`(icon 21·gap14·padV14·padH8·pressed 0.6·`negative` tint·`body`) ↔ `LeaveLogSheets.tsx:138-174` | **PASS** — 값·토큰 전부 동일 복제 |
| 5 | danger 버튼 | `MuklogDetailScreen.tsx:481-505`(`negative` bg·`radius.control`·padV14·`negativeFg` `button`·ActivityIndicator·disabled 0.45/pressed 0.85) ↔ `LeaveLogSheets.tsx:97-121` | **PASS** — 인라인 `Pressable` 패턴 1:1(공용 Button에 negative variant 없음 → ui-spec §4 근사 기록대로 복제) |
| 6 | ghost "취소" | `MuklogDetailScreen.tsx:506-513` ↔ `LeaveLogSheets.tsx:122-129` | **PASS** — `Button variant="ghost" full`, `leaving` 시 disabled 동일 |
| 7 | 확인 본문 타이포/간격 | `MuklogDetailScreen.tsx:471-473`(bodySm·fgMuted·center·marginBottom 18) ↔ `LeaveLogSheets.tsx:79-85` | **PASS** |
| 8 | 인라인 에러 | `MuklogDetailScreen.tsx:474-478`(bodySm·`error`·center·marginBottom 12) ↔ `LeaveLogSheets.tsx:86-94` | **PASS** |
| 9 | 배너 약톤 톤 | `ScheduledDeletionBanner.tsx:41-51` | **PASS** — `negativeWeak` bg·`radius.sheet`·`CircleInfo` `negative` 아이콘. status-negative 톤 정합 |
| 10 | `negativeWeak` 토큰 값·다크 미러 | `tokens.ts:108`(light `rgba(229,72,77,0.10)`)·`:143`(dark `rgba(229,72,77,0.22)` override) | **PASS** — ui-spec §2 값 일치, 다크 미러 명시 override 존재(어두운 surface 가독 위해 진하게) |
| 11 | raw hex/숫자 색상 0 | `grep -nE "#hex\|rgba("` → 두 컴포넌트 **0건**, 전부 `theme.color.*` | **PASS** |

---

## ③ 텍스트·카피 (plan §4 SSOT)

| # | 항목 | RN 값 | 판정 |
|---|---|---|---|
| 12 | 카피 정확성·해요체 | 커플 `로그에서 나갈까요?` / 24h 유예 본문(`…24시간 뒤 삭제돼요…`) / `나가기` · 솔로 `로그를 삭제할까요?` / `…되돌릴 수 없어요.` / `삭제하기` · 공통 ghost `취소` · 배너 요청자 `이 로그는 {label} 예정이에요` / 상대 `상대가 로그에서 나가 {label} 예정이에요` · 취소 `삭제 취소` (`LeaveLogSheets.tsx:15-22`·`ScheduledDeletionBanner.tsx:15-18`) | **PASS** — ui-spec §3.1·§3.2·체크리스트 L139와 전부 일치. 해요체·구체 표현 준수 |

> 참고(비결함): `삭제 취소`(배너)·`나가기`/`삭제하기` 라벨은 ui-spec이 정확한 문자열을 핀하지 않은 영역이나 plan §4 의미·해요체에 부합 → 통과. 요청자 분기 카피 정확.

---

## ④ LogScreen 통합 (2차 재검증 — developer 배선 완료 후)

`LogScreen.tsx` 배선 완료(1094 green/tsc 0). 아래 전부 ui-spec §3.3 골격대로 정합:

| # | 항목 | RN ↔ ui-spec | 판정 |
|---|---|---|---|
| P1 | 헤더 ⋯ 진입 | `LogScreen.tsx:520-526`(`IconName.MoreHorizontal` 24·`fg`·"더보기"·`setMenuOpen(true)`), `LogTitleButton` `flex:1`(`components/LogTitleButton.tsx:49`)로 ⋯ 우측 끝 정렬 ↔ ui-spec §3.3-1 | **PASS** |
| P2 | 배너 위치/게이팅 | `LogScreen.tsx:531-543` — 헤더(L527) 아래·`segWrap`(L546) 위, `room.deleteScheduledAt ? … : null` 게이팅, 세그 본문 스위치 밖이라 세그 무관 항상 표시(padH20·padT8) ↔ ui-spec §3.3-2·체크리스트 L141 | **PASS** |
| P3 | 시트 controlled 마운트·카피 분기 | `LogScreen.tsx:608-621` — `Screen` 말미(Toast 옆) 마운트, `menuVisible/confirmVisible` 부모 소유, `onSelectLeave`=메뉴 close+확인 open, `isCouple`(L417 `memberCount>=2`)로 커플/솔로 카피 분기, 성공 닫기는 `handleLeave`(커플=refresh·솔로=goBack, L453-466) ↔ ui-spec §3.3-3·4 | **PASS** |
| P4 | isRequester 실주입 | `LogScreen.tsx:538` `isRequester={meId === room.deleteRequestedBy}` → 요청자=취소 버튼/상대=안내only(컴포넌트 분기 `ScheduledDeletionBanner.tsx:56`) ↔ plan §4·§6 이중 방어 | **PASS** |

> 4건 전부 PASS — PENDING 해소. (배너 `countdownLabel` 계산·`deleteScheduledAt` 데이터 정합은 qa-logic 영역, 비주얼 비대상.)

---

## ui-publisher 수정 요청

**없음.** 두 컴포넌트·토큰 모두 기존 패턴·토큰과 정합. 드리프트(치수/토큰/카피) 0건.

## RN 근사 허용(통과 처리)

- danger 버튼 인라인 `Pressable` 복제(공용 Button negative variant 부재) — ui-spec §4 기록대로 MuklogDetail과 동일 패턴 → **근사 허용**.
- `Sheet` 상단 라운드 26·딤 0.32(blur 미지원 반투명 근사) — 공용 컴포넌트 기존 근사 위에 얹음 → **근사 허용**.
- 배너 등장/소멸 애니메이션 없음 — plan 범위 외 → **허용**.
