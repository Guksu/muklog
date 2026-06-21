# Dev Notes: 폰트 SUIT 전환 (sprint-20260620-font-suit)

## 요약
RN 전 화면 기본 글꼴 Pretendard → SUIT 전환 완료. 폰트 자산(정적 weight 4종) 교체 + `fontMap` 재매핑 + `typography` family 일괄 치환 + 인라인 fontFamily 리터럴 정합 + 주석/문서 갱신. 메트릭(fontSize/lineHeight/ratio)·컬러·radius·섀도우·간격 토큰 전부 불변. 회귀 0.

## 변경 파일
### 자산
- `assets/fonts/SUIT-Regular.ttf` (594,324 B), `SUIT-Medium.ttf` (592,832 B), `SUIT-SemiBold.ttf` (591,696 B), `SUIT-Bold.ttf` (589,892 B) — 신규 다운로드(sun-typeface SUIT@2 static/ttf, SIL OFL). 4파일 모두 유효 TrueType(매직넘버 `00010000`, `file` 판정 "TrueType Font data", Version 2.040).

### 소스
- `src/theme/fonts.ts` — `fontMap`을 SUIT 4키(`SUIT-Regular/Medium/SemiBold/Bold` → 각 SUIT TTF)로 재매핑. Pretendard 키 4개 제거(미참조 → expo-font 번들 제외). 헤더 주석 갱신(SUIT 기준·정적 weight 사유·Pretendard 보존 메모).
- `src/theme/tokens.ts` — `typography` 전 항목(~40종) `fontFamily` 접두 `Pretendard-` → `SUIT-` 일괄 치환(치환표대로: 800/700→SUIT-Bold, 600→SUIT-SemiBold, 500→SUIT-Medium, 400→SUIT-Regular). `makeTypography` 시그니처·size/ratio·lineHeight 계산 전부 불변(family 인자만 변경). 타이포 블록 헤더 주석 "Pretendard 기반"→"SUIT 기반".
- `src/theme/tokens.spec.ts` (Red→Green) — body 계열 family 단언 SUIT-Medium으로 갱신. **신규 전수 단언 추가**: `Object.values(typography)` 순회로 모든 항목 family가 `SUIT-`로 시작하고 `Pretendard-`로 시작하지 않음을 단언(AC2). 개별 family 단언(sectionTitle/navTitle/sheetTitle/sectionLabel/memoBody/calendar*)도 SUIT로 갱신. 헤더 주석 갱신.
- `src/navigation/HomeTabs.tsx:40` — 탭바 라벨 인라인 `fontFamily: 'Pretendard-SemiBold'` → `'SUIT-SemiBold'`.
- `src/navigation/screens/SplashView.tsx:74` — tagline 인라인 `fontFamily` → `'SUIT-SemiBold'`. 워드마크 미러 주석(70행) SUIT로.
- `src/navigation/screens/LoginScreen.tsx:134` — copy 인라인 `fontFamily` → `'SUIT-SemiBold'`. 워드마크 미러 주석(130행) SUIT로.
- `src/navigation/HomeHeader.tsx:3` — 워드마크 주석 SUIT로.
- `App.tsx:2` — "Pretendard 폰트 로드" 서술 → "SUIT 폰트 로드".
- `docs/design/architecture.md:260` — "폰트는 Pretendard를…" → SUIT(SIL OFL·정적 weight 4종·2026-06-20 전환) 서술.

> **계획 범위 보강(자체 판단)**: plan/ui-spec은 tokens.ts typography에 집중했으나, `HomeTabs/SplashView/LoginScreen`에 **인라인 `fontFamily: 'Pretendard-*'` 리터럴 3건**이 존재했다. fontMap에서 Pretendard 키가 빠지면 이 리터럴들은 로드 안 된 family를 가리켜 시스템 폰트로 폴백된다 → AC2 의도(Pretendard 0건·SUIT 전환) 위반. 따라서 동일 weight의 SUIT 리터럴로 정합했다(메트릭 불변). qa-logic 경계면 검증 포인트.

## 경계면 매핑 (생산자 ↔ 소비자)
| fontMap 키 (fonts.ts) | typography family (tokens.ts) | App.tsx 로딩 |
|---|---|---|
| `SUIT-Regular` | (현재 typography엔 직접 사용 없음 — Regular 토큰 미지정, fontMap엔 등록해 향후/외부 사용 대비) | `Font.loadAsync(fontMap)` (App.tsx loadFonts, `@/theme/fonts`) |
| `SUIT-Medium` | body/bodyLg/bodySm/caption/sectionCaption/meta/memoBody/dialogSubtitle/notifItemDesc/notifHint 등 | 동일 |
| `SUIT-SemiBold` | h3/spotCount/dialogInput/calendarDay/dateRowValue/notifLogName + 인라인(HomeTabs·SplashView·LoginScreen) | 동일 |
| `SUIT-Bold` | display/h1/h2/wordmark/cardTitle/emptyTitle/sectionTitle/navTitle/badge/button/sheetTitle/sectionLabel/fieldLabel/ratingNum/inviteCode/profileName/dialogTitle/calendarMonth/calendarDow/calendarDayStrong/notifItemTitle/notifSectionLabel | 동일 |

- 생산자: `fontMap`(키 = 등록 family명) → `App.tsx` `loadFonts()`의 `Font.loadAsync(fontMap)`로 네이티브 등록.
- 소비자: `typography.*.fontFamily` 문자열 + 위 3개 인라인 리터럴이 등록 키와 1:1 정확 매칭.
- **누락 family 0**: typography·인라인이 참조하는 family 4종(Regular는 미참조이나 등록은 유지) 모두 fontMap에 존재. fontMap 키 ↔ 참조 family 정합 확인.

## Pretendard 자산 보존
- `assets/fonts/Pretendard-{Regular,Medium,SemiBold,Bold}.ttf` 4파일은 **삭제하지 않고 보존**(데이터 손실 회피). `fontMap`·코드 어디서도 미참조이므로 expo-font 등록 대상에서 제외되어 **번들에 포함되지 않는다**(런타임 영향 0). 추후 사용자가 수동 정리 가능.

## RN 폴백 한계 (ui-spec 근거)
- 킷의 `--font-sans` 다단 폴백 체인(SUIT → Pretendard JP → Pretendard → system)은 **웹 CSS 전용** 개념. RN `fontFamily`는 단일 정확 매칭이라 글리프 단위 폴백이 없다 → typography는 단일 `SUIT-*`로 지정.
- 폰트 **로드 자체 실패** 시에만 `App.tsx`의 `Font.loadAsync(...).catch()` 안전장치로 시스템 폰트 진입(영구 스플래시 방지). 별도 폴백 체인은 추가하지 않음 — ui-spec이 "킷 의도(SUIT 우선)의 합리적 RN 근사"로 명시(qa-visual 근사 허용 기준).
- SUIT 정적 TTF는 가변폰트의 특정 weight 인스턴스라 킷 웹 가변 렌더와 픽셀 동일하진 않으나, weight 4단(400/500/600/700+800→700) 매핑은 Pretendard와 동일 정책이라 시각 일관성 유지.
- 한글 글리프 실제 렌더 차이는 **디바이스 스모크 영역(런타임)** — 본 스프린트는 정합·빌드까지. Dev Client 재빌드 후 육안 확인은 사용자 안내(자산 신규 추가라 재빌드 필요).

## 테스트 / tsc 결과 (실제 출력)
### Red (구현 전, tokens.ts 미수정 상태)
```
Test Suites: 1 failed, 1 total
Tests:       9 failed, 48 passed, 57 total
  ● tokens — typography (AC-5) › body/bodyLg/bodySm의 기본 family가 SUIT-Medium이다
    Expected: "SUIT-Medium"  Received: "Pretendard-Medium"
  (+ sectionTitle/navTitle/sheetTitle/sectionLabel/memoBody/calendar* 등 9건 실패)
```

### Green (구현 후) — `npm test`
```
Test Suites: 138 passed, 138 total
Tests:       1238 passed, 1238 total
Snapshots:   0 total
Time:        5.398 s
```

### tsc — `npx tsc --noEmit`
```
EXIT=0   (0 에러)
```

## AC 충족
- AC1 ✅ fontMap = SUIT 4키, Pretendard 키 0.
- AC2 ✅ typography 전 항목 family `SUIT-` 시작(전수 단언 통과) + 인라인 리터럴 3건도 SUIT로 정합. src 내 `fontFamily/family: 'Pretendard'` 리터럴 0건(grep 확인).
- AC3 ✅ SUIT TTF 4파일 존재·유효(크기>0, 매직넘버 00010000).
- AC4 ✅ `npm test` 1238 green.
- AC5 ✅ `npx tsc --noEmit` 0 에러.
- AC6 ✅ App.tsx·fonts.ts·architecture.md:260 + (보강) HomeHeader/SplashView/LoginScreen 주석 SUIT로 갱신.

## 미완 / 후속
- 없음(스프린트 범위 완료). 디바이스 육안 확인(한글 글리프)은 사용자 재빌드 후 스모크 권장.
- Pretendard `.ttf` 물리 삭제는 사용자 재량(현재 보존, 번들 미포함).
