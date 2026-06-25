# Sprint: 전역 타이포 한글 클리핑 수정 (sprint-20260625-typo-clipping)

## 단일 기능
`tokens.ts` typography 중 **`lineHeight == fontSize`(ratio:1)** 인 토큰들의 한글 글리프 상단 클리핑을 해소한다. 직전 버그픽스 #5(지도 카드)는 인라인으로 막았으나, 같은 결함이 다른 화면에도 잠재(qa 공통 권고). 토큰 레벨에서 근본 수정.

## 배경
- RN `Text`는 `lineHeight`가 `fontSize`와 같거나 작으면 한글(SUIT) 글리프 윗부분(받침 위 여백 적은 글꼴)이 잘릴 수 있음(메모리 [[qa-layout-blind-spot]]).
- 영향 토큰(ratio:1, 총 12개): `wordmark`(26)·`meta`(13)·`spotCount`(14)·`badge`(12)·`ratingNum`(15)·`inviteCode`(26)·`calendarMonth`(17)·`calendarDow`(12)·`calendarDay`(14.5)·`calendarDayStrong`(14.5)·`dateRowValue`(15)·`notifSectionLabel`(13).
- 영문/숫자 위주 토큰(`inviteCode`=영숫자 코드, `calendarDay`=숫자, `ratingNum`=숫자)은 클리핑 영향이 적지만, 일관성·안전상 함께 lineHeight 여유 부여.

## 설계 — lineHeight만 키우고 위치/정렬은 보존
- 각 ratio:1 토큰의 `ratio`를 **1.0 → 약 1.25~1.3**으로 올려 lineHeight를 fontSize보다 크게(클리핑 해소). fontSize·family·weight·letterSpacing 불변(시각 크기 동일).
  - 예: `meta` 13/13 → 13/16, `wordmark` 26/26 → 26/33 등. 정확 배수는 글리프 안전선(상단 여유 ≥ fontSize×0.2) 확보 + 정수 lineHeight.
- **회귀 민감 토큰은 사용처 함께 점검**(컨테이너 고정 높이 + 중앙정렬이면 lineHeight 증가가 수직 정렬을 바꿀 수 있음):
  - `badge`(MemberBadge 고정 pill)·`spotCount`(칩/통계 행)·`calendarDay`/`calendarDayStrong`(날짜 셀 그리드 고정 정사각)·`calendarDow`(요일 헤더)·`wordmark`(헤더, letterSpacing 밀착)·`inviteCode`(코드 카드).
  - 이들은 lineHeight 증가 후 **컨테이너가 `alignItems:center` + 충분한 높이**면 안전. 셀 높이가 텍스트에 딱 맞춰진 곳은 `textAlignVertical`/패딩으로 보정하거나 해당 토큰만 보수적 증가(1.15).
- 직전 #5에서 지도 카드 메타에 넣은 **인라인 `lineHeight:18` 오버라이드는 제거**(토큰이 근본 해결하므로 중복 불필요) — 단 토큰 meta lineHeight가 18 이상이면 제거, 미만이면 유지 판단.

## 인수조건 (= 테스트, TDD)
- **AC1** ratio:1 이던 12개 토큰 모두 `lineHeight > fontSize`(tokens.spec 단언 — `Object.entries(typography)`에서 lineHeight ≥ fontSize × 1.15 또는 명시 목록 검증). 기존 ratio:1 단언이 있으면 갱신.
- **AC2** fontSize·fontFamily 불변(크기·두께 회귀 0) — spec으로 각 토큰 fontSize/family 고정 단언 유지.
- **AC3** 시각 회귀 0: 영향 화면(홈 카드·MemberBadge·프로필 통계·캘린더 시트·초대코드·알림 설정·헤더 워드마크·지도 카드) 렌더 테스트 통과. 고정높이 컨테이너(배지·캘린더 셀)에서 텍스트 잘림/넘침 없음.
- **AC4** 직전 #5 지도 카드 인라인 오버라이드 정리(토큰으로 일원화 or 명시 유지 근거).
- **AC5** `npm test` green + `tsc --noEmit` 0. 회귀 0.

## 리스크
- **캘린더 날짜 셀**: 7열 그리드 + 고정 셀 높이라 lineHeight 증가가 셀 wrap/정렬 깨뜨릴 수 있음(메모리 [[qa-layout-blind-spot]] 캘린더 토요일 wrap 선례) → 디바이스 스모크 필수, 보수적 증가.
- **MemberBadge/배지**: pill 높이가 텍스트에 타이트하면 lineHeight 증가로 pill이 커질 수 있음 → 사용처 패딩 확인.
- **헤더 워드마크**: baseline 정렬(`alignItems:baseline`) 영향 점검.
- 토큰은 전역이라 한 토큰이 여러 화면 영향 → qa-visual이 화면별 교차 점검.

## 작업
1. (ui-publisher) ratio:1 12토큰 lineHeight 상향(안전 배수) + tokens.spec 갱신 + 회귀 민감 사용처(배지·캘린더·헤더·통계) 점검·보정 + #5 인라인 정리. ui-spec 기록.
2. (qa-visual) 영향 화면 전수 비주얼(잘림 해소 + 고정높이 회귀 0) / (qa-logic) tokens.spec 의미·회귀·tsc.
