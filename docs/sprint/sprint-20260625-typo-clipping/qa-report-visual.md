# QA Report — Visual (sprint-20260625-typo-clipping)

전역 타이포 토큰 12개의 lineHeight 상향(한글 상단 클리핑 해소). **비주얼 충실도 검증 전용** — 수정 없음.

## 종합 판정: 통과 (PASS)

- 12토큰 **fontSize·fontFamily(weight)·letterSpacing 전부 불변, lineHeight만 증가** — 시각 크기/두께 회귀 0 확인.
- 회귀 민감 사용처(캘린더 7열 셀·MemberBadge pill·헤더 워드마크·홈 통계·초대코드) **구조상 넘침/정렬깨짐 위험 0**.
- #5(지도 카드) 인라인 `lineHeight:18` 오버라이드 제거 → `meta` 토큰(lh18)로 일원화, 시각 18→18 무변화.
- tsc 0 error, tokens.spec 65 green, 영향 9개 render suite 108 green.
- 단, **픽셀 단위 클리핑 해소·캘린더 wrap은 렌더 테스트로 못 봄 → 디바이스 스모크 필수**(아래 §디바이스 스모크).

---

## ① 크기·두께 불변 (검증1)

`src/theme/tokens.ts:203-234` 전수 확인 — 12토큰 모두 `makeTypography` 호출에서 **`size`/`family` 인자 그대로, `ratio`만 1.0→상향**. lineHeight = `Math.round(size×ratio)`.

| 토큰 | fontSize(불변) | family(불변) | lineHeight | lh>fs |
|---|---|---|---|---|
| wordmark | 26 | SUIT-Bold | 26→33 | ✅ |
| meta | 13 | SUIT-Medium | 13→18 | ✅ |
| spotCount | 14 | SUIT-SemiBold | 14→18 | ✅ |
| badge | 12 | SUIT-Bold | 12→14 | ✅ |
| ratingNum | 15 | SUIT-Bold | 15→19 | ✅ |
| inviteCode | 26 | SUIT-Bold | 26→33 | ✅ |
| calendarMonth | 17 | SUIT-Bold | 17→22 | ✅ |
| calendarDow | 12 | SUIT-Bold | 12→14 | ✅ |
| calendarDay | 14.5 | SUIT-SemiBold | 14.5→17 | ✅ |
| calendarDayStrong | 14.5 | SUIT-Bold | 14.5→17 | ✅ |
| dateRowValue | 15 | SUIT-SemiBold | 15→20 | ✅ |
| notifSectionLabel | 13 | SUIT-Bold | 13→17 | ✅ |

- **letterSpacing**: 타이포 토큰엔 letterSpacing 필드가 없고 사용처 인라인 스타일에 있음 — `HomeHeader.tsx:107`(wordmark `-0.5`), `InviteCodeCard.tsx:17,68`(inviteCode `4`/.18em). 두 사용처 스타일 모두 미변경 → **letterSpacing 보존 확인**.
- tokens.spec(`src/theme/tokens.spec.ts:209-256`)이 12토큰 fontSize/fontFamily를 개별 고정 단언(AC2) + `lineHeight>fontSize`·`≥fs×1.15`(AC1) + 전역 `lineHeight>=fontSize` 안전망으로 잠금 → 회귀 방지 단언이 의미 있음(단순 존재 아님).

## ② 회귀 민감 — 고정높이/그리드 컨테이너 (검증2)

| 사용처 | 토큰 | 컨테이너 구조(파일:라인) | 판정 |
|---|---|---|---|
| **캘린더 날짜 셀** | calendarDay/Strong(lh17) | `cell: flex:1, aspectRatio:1, padding:1`(`DatePickerSheet.tsx:212`) → `dayButton: flex:1, alignItems/justifyContent:center`(:213). 셀 변≈47px(375폭 기준), 단일 숫자 1줄 | **안전**. lh17 ≪ 셀높이, 중앙정렬, numberOfLines 무관 단일 숫자 → wrap/넘침 0. 토요일 wrap 선례는 주(7칸) **행 분할**(:90-95)로 이미 차단됨 — lh 증가가 재유발 안 함 |
| **요일 헤더** | calendarDow(lh14) | `dowCell: flex:1, textAlign:center, paddingVertical:6`(:209) | **안전**. 단일 글자, 고정높이 아님 |
| **월 네비** | calendarMonth(lh22) | navRow `alignItems:center`(:196), navArrow 40×40 형제 → 행높이 = max(텍스트박스, 40). lh22 < 40 | **안전**. 행 높이 미변동 |
| **MemberBadge pill** | badge(lh14) | `alignSelf:flex-start`, paddingTop/Bottom:3, **고정높이 없음**(`MemberBadge.tsx:39-48`) | **안전**. 콘텐츠 높이 성장 → lh 12→14면 pill +2px(상하 균등), 이모지(fontSize12) row 중앙정렬 유지 |
| **헤더 워드마크** | wordmark(lh33) | left `row, alignItems:baseline`(`HomeHeader.tsx:105`), container `alignItems:center` **고정높이 없음** | **안전**. baseline 정렬이라 시각 baseline 위치 보존, 글리프는 더 큰 box 중앙에 → 상단 클리핑만 해소 |
| **홈 통계 행** | spotCount(lh18)/meta(lh18) | statsRow `row, alignItems:center`, 고정높이 아님(`LogListScreen.tsx:177-185`) | **안전**. Location 아이콘(15)과 row 중앙정렬, 콘텐츠 높이 |
| **초대코드 카드** | inviteCode(lh33) | codeBlock `flex:1`, 카드 `row, alignItems:center`(`InviteCodeCard.tsx:85-87`), 고정높이 아님 | **안전**. 영숫자라 클리핑 영향 적으나 lh33 여유. 복사버튼과 중앙정렬 |

판정 근거: 회귀 민감 사용처는 **전부 고정높이 컨테이너가 아니거나(콘텐츠 높이 성장), 텍스트보다 큰 고정 형제+중앙정렬**. lineHeight 증가가 wrap/넘침/정렬깨짐을 구조적으로 유발하지 않음.

## ③ #5 일원화 (검증3)

- `NearbySpotCard.tsx:45,98-106`·`SelectedSpotCard.tsx:35,76-85` — 인라인 `META_LINE_HEIGHT=18`/`style={{lineHeight}}` 상수·오버라이드 **제거됨**, `variant="meta"`(토큰 lh18)로 환원, `marginTop:spacing[4]`만 유지. 주석 "meta 토큰이 토큰 레벨로 해결"로 갱신.
- 시각 lineHeight 18→18 동일 → **지도 카드 렌더 변화 0**. tokens.spec AC4(`:268-269` meta.lineHeight≥18)가 흡수 보증.

## ④ 클리핑 해소 방향 (검증4)

12토큰 모두 `lineHeight ≥ fontSize×1.15`(상단 여유 ≥ fontSize×0.15~0.4) → RN Text 한글(SUIT) 글리프 상단 클리핑 해소 방향이 맞음(메모리 qa-layout-blind-spot 원리 일치). 보수적 토큰(badge·calendarDow/Day/Strong=1.15~1.2)은 회귀 우선이라 최소 여유지만 lh>fs라 클리핑 해소 효과는 확보.

---

## 디바이스 스모크 필수 (렌더 테스트 사각지대 — 메모리 qa-layout-blind-spot)

렌더 테스트는 픽셀 클리핑·실제 wrap을 못 봄. 실기/시뮬레이터 확인 권고:
1. **캘린더 시트**: 7열 그리드 토/일 열 wrap 0, 셀 중앙정렬·오늘 dot(bottom 5) 위치 유지, 날짜 숫자 상단 잘림 0.
2. **MemberBadge**("둘이"/"혼자"): pill 높이 타이트 유지, 한글 상단 잘림 0.
3. **홈 헤더 워드마크**("먹로그"): baseline 정렬 유지, 글리프 상단 잘림 0.
4. **홈 통계·초대코드·알림 설정·지도 주변/선택 카드**: 한글 상단 잘림 해소 + 레이아웃 변화 0.

## 비주얼 관찰(비-차단, 범위 외 — 정보)

- `MemberBadge.tsx:5` 주석이 "700/11.5"로 적혀 있으나 실제 토큰은 fontSize 12 — **스테일 주석**(코드·렌더 영향 0, 비차단).
- 같은 한글 클리핑 **로컬 raw 패치**가 토큰 밖 2곳에 존재: `ProfileScreen.tsx:421 settingsLabel(fontSize15/lh20)`·`PlaceSelectedSummary.tsx:98 sub(fontSize12.5/lh17)`. 둘 다 **역할 토큰이 아닌 독립 raw 스타일**(fontSize가 토큰과 다름)이라 이번 12토큰 변경과 충돌·중복 아님 — 정상 동작. 본 스프린트 범위 밖이며 별도 정리 불요(필요 시 향후 토큰 일원화 후보로만 플래그).

## 검증 로그

- `tsc --noEmit`: 0 error.
- `tokens.spec.ts`: 65 passed (AC1/AC2/AC4 단언 포함).
- 영향 9개 suite(MemberBadge·DatePickerSheet·InviteCodeCard·HomeHeader·LogListScreen·NotifSettingsView·MuklogDetailScreen·NearbySpotCard·SelectedSpotCard): **108 passed**.
