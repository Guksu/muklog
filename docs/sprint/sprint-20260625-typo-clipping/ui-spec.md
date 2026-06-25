# UI Spec — 전역 타이포 한글 클리핑 수정 (sprint-20260625-typo-clipping)

## 요약
`tokens.ts` typography 중 `lineHeight == fontSize`(ratio:1)이던 **12개 역할 토큰**의 `ratio`만 상향해 한글 글리프 상단 클리핑을 토큰 레벨로 근본 해소했다. **fontSize·fontFamily(=weight)·letterSpacing은 전부 불변** — 시각 크기/두께 회귀 0, lineHeight만 키움. 직전 버그픽스 #5(지도 카드 인라인 `lineHeight:18`)는 토큰이 흡수하므로 제거해 일원화했다.

원리: RN `Text`는 `lineHeight <= fontSize`일 때 한글(SUIT) 글리프 윗부분이 잘릴 수 있음(메모리 qa-layout-blind-spot). 상단 여유 ≥ fontSize×0.2를 목표로 ratio를 1.15~1.4로 부여(회귀 민감 토큰은 보수적 1.15~1.2), lineHeight는 `Math.round(size×ratio)` 정수.

## 토큰별 before/after (size 불변, lineHeight만 변경)

| 토큰 | family(불변) | fontSize(불변) | ratio before→after | lineHeight before→after | lh/fs | 비고 |
|---|---|---|---|---|---|---|
| `wordmark` | SUIT-Bold | 26 | 1.0 → **1.27** | 26 → **33** | 1.27 | 헤더 워드마크. 보수적·baseline 행 |
| `meta` | SUIT-Medium | 13 | 1.0 → **1.4** | 13 → **18** | 1.38 | 카드 날짜 메타. lh18=지도카드 인라인 흡수 |
| `spotCount` | SUIT-SemiBold | 14 | 1.0 → **1.3** | 14 → **18** | 1.29 | "맛집 N곳" 통계 |
| `badge` | SUIT-Bold | 12 | 1.0 → **1.2** | 12 → **14** | 1.17 | MemberBadge pill. 보수적 1.2 |
| `ratingNum` | SUIT-Bold | 15 | 1.0 → **1.25** | 15 → **19** | 1.27 | 별점 숫자(숫자지만 일관성) |
| `inviteCode` | SUIT-Bold | 26 | 1.0 → **1.25** | 26 → **33** | 1.27 | 초대코드(영숫자지만 일관성). letterSpacing은 사용처 .18em 유지 |
| `calendarMonth` | SUIT-Bold | 17 | 1.0 → **1.3** | 17 → **22** | 1.29 | "YYYY년 M월" |
| `calendarDow` | SUIT-Bold | 12 | 1.0 → **1.15** | 12 → **14** | 1.17 | 요일 헤더. 보수적 1.15 |
| `calendarDay` | SUIT-SemiBold | 14.5 | 1.0 → **1.15** | 14.5 → **17** | 1.17 | 날짜 셀 기본. 보수적 1.15(정사각 셀) |
| `calendarDayStrong` | SUIT-Bold | 14.5 | 1.0 → **1.15** | 14.5 → **17** | 1.17 | 날짜 셀 선택/오늘. 보수적 1.15 |
| `dateRowValue` | SUIT-SemiBold | 15 | 1.0 → **1.3** | 15 → **20** | 1.33 | 방문일 진입 행 날짜 |
| `notifSectionLabel` | SUIT-Bold | 13 | 1.0 → **1.3** | 13 → **17** | 1.31 | "로그별 알림" 섹션 라벨 |

- 변경 메서드: `makeTypography` 호출의 `ratio` 인자만 수정. `size`/`family` 인자는 한 글자도 안 바뀜.
- 전 토큰 `lineHeight >= fontSize × 1.15` (라운딩 후 검증, AC1). `typography` 전 항목에 `lineHeight >= fontSize` 안전망 단언 추가(어떤 토큰도 ratio<1 금지).

## 회귀 민감 사용처 점검 결과

| 사용처 | 토큰 | 컨테이너 구조 | 판정 |
|---|---|---|---|
| `DatePickerSheet.tsx` 날짜 셀 | calendarDay/Strong | `cell: flex:1, aspectRatio:1`(정사각 그리드) → `dayButton: flex:1, alignItems/justifyContent:center` | **안전**. 단일 숫자가 정사각 버튼 중앙정렬. lineHeight 17은 셀 높이보다 작아 wrap·정렬 변화 없음. 보수적 1.15 채택(메모리 토요일 wrap 선례 회피) |
| `DatePickerSheet.tsx` 요일 헤더 | calendarDow | `dowCell` 단일 글자, 셀 폭 고정 | **안전**. 보수적 1.15 |
| `DatePickerSheet.tsx` 월 네비 | calendarMonth | nav 행 `alignItems/justifyContent:center`, navSize 고정 높이 | **안전**. lh22 < navSize. 디바이스 스모크 권고(아래) |
| `MemberBadge.tsx` pill | badge | `alignSelf:flex-start`, paddingTop/Bottom 3, **고정 높이 없음**(콘텐츠 높이) | **안전**. lh 12→14면 pill 높이 +2px(상하 +1px 균등). 킷 pad 3/9/3/7 유지. 보수적 1.2 |
| `HomeHeader.tsx` 워드마크 | wordmark | `left: row, alignItems:baseline`, 헤더 container **고정 높이 없음**(`alignItems:center`) | **안전**. baseline 정렬이라 시각 baseline 위치 보존, 글리프는 더 큰 box 안에서 중앙정렬돼 상단 잘림만 해소. letterSpacing -0.5 유지. 보수적 1.27 |
| `LogListScreen` 홈 카드 통계 | spotCount/meta | 통계 행 텍스트 | **안전**. 고정 높이 컨테이너 아님 |
| `InviteCodeCard.tsx` | inviteCode | 코드 카드 텍스트, letterSpacing .18em | **안전**. 영숫자라 클리핑 영향 적으나 일관성 부여, lh33으로 여유 |
| `NearbySpotCard`/`SelectedSpotCard` 메타 | meta | 카드 메타 줄(numberOfLines:1) | **안전**. 토큰 lh18이 인라인 18을 흡수 → 인라인 제거(AC4) |

공통: 회귀 민감 토큰의 사용처는 모두 **고정 높이 컨테이너가 아니거나(콘텐츠 높이로 성장), 텍스트보다 큰 고정 컨테이너 + 중앙정렬**이라 lineHeight 증가가 잘림/넘침/wrap을 유발하지 않음. 캘린더 정사각 셀만 메모리상 선례가 있어 보수적 1.15로 최소 증가.

## #5 인라인 처리 (AC4)
- `meta` 토큰 lineHeight가 18(=13×1.4 round)이라 직전 #5에서 두 지도 카드에 넣은 인라인 `const META_LINE_HEIGHT = 18` + `style={{ lineHeight: META_LINE_HEIGHT }}` 오버라이드가 **불필요 중복** → 양쪽 모두 **제거**. 토큰으로 일원화.
- 변경: `src/features/map/components/NearbySpotCard.tsx`(상수·인라인 제거, `marginTop`만 유지), `src/features/map/components/SelectedSpotCard.tsx`(상수·인라인 제거, `style={styles.meta}`로 환원). 주석을 "meta 토큰이 토큰 레벨로 해결"로 갱신.
- 회귀: 시각 lineHeight 동일(18→18)이라 지도 카드 렌더 변화 0.

## tokens.spec 갱신 (AC1·AC2)
`describe('tokens — typo 한글 클리핑 수정 ...')` 신규 블록 추가:
- **AC1**: 대상 12토큰 `lineHeight > fontSize`, `lineHeight >= fontSize×1.15` 단언 + 전역 `lineHeight >= fontSize` 안전망.
- **AC2**: 대상 12토큰 fontSize/fontFamily 고정 단언(크기·두께 회귀 방지).
- **AC4**: `meta.lineHeight >= 18`(인라인 흡수 보증).
- 회귀 민감 토큰 보수값 잠금: calendarDay/Strong=17, calendarDow=14, badge=14.
- 기존 typography 단언(fontSize/family)은 모두 유지·통과(ratio만 바뀌었으므로 불변).

## 디바이스 스모크 권고 (QA)
토큰은 전역이라 픽셀 검증이 필요(렌더 테스트는 잘림을 못 봄 — 메모리 qa-layout-blind-spot). 다음 화면을 실기/시뮬레이터에서 확인:
1. **캘린더 시트**(DatePickerSheet): 7열 날짜 그리드에 토요일·일요일 열 wrap 없음, 셀 정렬·오늘 점 위치 유지, 날짜 숫자 잘림 0.
2. **MemberBadge**: "단둘이"/"N명" pill 높이가 콘텐츠에 타이트하게 유지, 한글 상단 잘림 0.
3. **홈 헤더 워드마크**: "먹로그" + 이모지 baseline 정렬 유지, 글리프 상단 잘림 0.
4. **홈 카드 통계·초대코드·알림 설정·지도 주변/선택 카드**: 한글 상단 잘림 해소 + 레이아웃 변화 0.

## 변경 파일
- `src/theme/tokens.ts` — 12토큰 ratio 상향(size/family 불변).
- `src/theme/tokens.spec.ts` — typo-clipping 단언 블록 추가.
- `src/features/map/components/NearbySpotCard.tsx` — #5 인라인 오버라이드 제거(토큰 일원화).
- `src/features/map/components/SelectedSpotCard.tsx` — #5 인라인 오버라이드 제거(토큰 일원화).

## 검증 (AC5)
- `npm test`: 147 suites / **1373 passed**, 0 fail.
- `tsc --noEmit`: **0 error**.
