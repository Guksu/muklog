# QA Report — Logic / 통합 정합 (sprint-20260625-typo-clipping)

검증자: qa-logic · 일자: 2026-06-25 · 범위: 로직·정합·테스트·컨벤션(비주얼 충실도 제외 → qa-visual)

## 종합 판정: **PASS (로직 완료)**

전역 타이포 한글 클리핑 수정은 `ratio`(=lineHeight)만 키우는 순수·국소 변경으로, fontSize/family 회귀 0, 테스트 1373 green, tsc 0 error, 컨벤션 위반 0. AC1~AC5 전부 통과. 미검증 0건.

> 참고: 본 스프린트 변경은 **working tree(uncommitted)** 상태(`git status`: tokens.ts·tokens.spec.ts·NearbySpotCard.tsx·SelectedSpotCard.tsx 4건 M). 비교 기준은 HEAD(=커밋 822d4d0 "버그수정", #5 인라인 도입 지점) ↔ 작업트리.

---

## AC별 결과

### AC1 — 12토큰 lineHeight > fontSize (tokens.spec, load-bearing) ✅ PASS
- `src/theme/tokens.spec.ts:209-279` 신규 블록 추가 확인. 12토큰 배열(`clipFixTokens`, :212-216)에 대해 `lineHeight > fontSize`(:218-223) + `lineHeight >= fontSize × 1.15`(:225-230) 단언.
- **load-bearing 사고실험 + 실증 검증**: `meta` ratio를 1.4→1로 되돌려 spec 단독 실행 → **3건 RED**(AC1 `>fontSize`, AC1 `>=1.15`, AC4 흡수). 단언이 실제로 깨지면 빨개짐을 실측 확인 후 파일 정확 복원(작업트리 backup 대조 identical, .bak 잔존 0).
- 12토큰 lineHeight 수식 전수 검증(`Math.round(size×ratio)`): wordmark 33·meta 18·spotCount 18·badge 14·ratingNum 19·inviteCode 33·calendarMonth 22·calendarDow 14·calendarDay 17·calendarDayStrong 17·dateRowValue 20·notifSectionLabel 17 — 전부 `>fontSize` 및 `>=fontSize×1.15` 만족(최소 마진 토큰 calendarDow/Day도 통과).
- 전역 안전망(`:232-236`, 전 항목 `lineHeight >= fontSize`)은 mutation 시 **green 유지** — 의도대로(ratio:1은 lh==fs라 `>=` 만족). `>fontSize` 가드는 AC1 단언이 담당, 안전망은 `ratio<1` 금지 바닥. 두 단언이 역할 분리돼 중복·공허 아님.

### AC2 — fontSize·family 불변(크기·두께 회귀 0) ✅ PASS
- `tokens.spec.ts:238-251` 12토큰 fontSize 고정 단언 + `:253-266` 12토큰 fontFamily 고정 단언 유지. 기존 ui-fidelity-audit·date-picker 블록의 fontSize/family 단언(:175-206, :386-408)도 잔존·통과.
- **diff 실증**(HEAD↔작업트리, `src/theme/tokens.ts`): 12토큰 모두 변경이 `ratio:` 인자에만 국한. `size:`·`family:` 토큰은 한 글자도 안 바뀜(예 `meta: size 13 / family SUIT-Medium` 동일, ratio 1→1.4만). 회귀 0.

### AC3(=불변 확인) — makeTypography·타 토큰 불변 ✅ PASS
- `makeTypography`(`tokens.ts:186-190`) 본문 미변경 — `lineHeight: Math.round(size*ratio)` 그대로. 변경은 호출부 ratio 인자뿐.
- ratio≠1 이던 토큰(display 1.2·h1 1.25·body 1.6·cardTitle 1.3·profileName 1.2·notifLogName 1.3 등) **미변경**(diff 무관). 12개 ratio:1 토큰만 상향.

### AC4 — #5 지도 카드 인라인 일원화 ✅ PASS
- **HEAD(822d4d0)**: NearbySpotCard `const META_LINE_HEIGHT = 18`(:48) + `style={[styles.meta,{marginTop, lineHeight: META_LINE_HEIGHT}]}`(:106); SelectedSpotCard 동일 상수(:38) + `style={[styles.meta,{lineHeight: META_LINE_HEIGHT}]}`(:84).
- **작업트리**: 양쪽 상수·인라인 `lineHeight` **완전 제거**. NearbySpotCard는 `style={[styles.meta,{marginTop: theme.spacing[4]}]}`로 marginTop만 유지(:99-104), SelectedSpotCard는 `style={styles.meta}`로 환원(:77-82). 주석을 "meta 토큰이 토큰 레벨로 해결"로 갱신.
- `grep "lineHeight|META_LINE_HEIGHT"` 두 파일 → 코드 매치 0(주석 라인만). 인라인 상수 잔존 0.
- **시각 회귀 0 보증**: meta 토큰 lineHeight = 13×1.4 = **18** = 제거된 인라인 18과 동일값. spec `:268-270` `meta.lineHeight >= 18` 가드가 흡수 보증(mutation 시 RED 확인).

### AC5 — npm test green + tsc 0 ✅ PASS (직접 재실행)
- `npx tsc --noEmit` → **exit 0, 0 error**.
- `npm test` → **Test Suites: 147 passed, 147 total / Tests: 1373 passed, 1373 total / 0 fail** (8.2s). dev-notes 주장(1373 green) 실측 일치.

---

## 컨벤션 (docs/code-convention.md) ✅
- `makeTypography` 호출 전수 named-object(`{ size, ratio, family }`) — 위치 인자 호출 0건(grep).
- raw 숫자 lineHeight 인라인 잔존 0(#5 제거로 토큰 일원화). useCallback/useMemo 무관(스타일 변경).

## 경계면 정합
- 토큰 생산자(`typography.meta` lineHeight 18) ↔ 소비자(NearbySpotCard/SelectedSpotCard `variant="meta"`) 값 일치 — 인라인 18 흡수로 소비처 렌더 lineHeight 불변. 회귀 민감 사용처(badge/calendarDay·Strong/calendarDow lineHeight=14/17/17/14)는 spec `:272-278`로 보수값 잠금.

## 미검증 / qa-visual 위임
- **픽셀 클리핑 해소·고정높이 셀(캘린더 7열 정사각·MemberBadge pill) wrap/정렬 회귀**: 렌더 테스트로는 글리프 잘림을 못 봄(메모리 qa-layout-blind-spot). ui-spec §디바이스 스모크 권고 항목(캘린더·배지·워드마크·지도 카드)은 **qa-visual + 디바이스 스모크 책임** — 로직 범위 외.

## 결론
AC1~AC5 전부 통과, 단언 load-bearing 실증(mutation RED), 회귀 0, tsc·test green. **로직 완료.** 잔여 리스크는 픽셀 레벨(qa-visual/디바이스 스모크)로 분리.
