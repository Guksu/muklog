# QA Report (Logic) — 폰트 SUIT 전환 (sprint-20260620-font-suit)

검증자: qa-logic | 날짜: 2026-06-20 | 범위: 로직·통합 정합성·TDD·컨벤션 (비주얼 충실도 제외 — qa-visual 담당)

## 종합 판정: **PASS (로직 완료)**

전 인수조건(AC1~AC6) 통과. 경계면(fontMap 키 ↔ typography family ↔ Font.loadAsync) 1:1 정합, 잔존 Pretendard 참조 0건, TDD 전수 단언이 load-bearing(뮤테이션으로 검증), `npm test` 1238 green + `tsc --noEmit` 0 에러를 **직접 재실행**해 확인. 미검증·이슈 없음.

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

### 1-1. fontMap 키 ⊇ typography family (런타임 로드 정합) — PASS
- **생산자** `src/theme/fonts.ts:10-15`: fontMap 등록 키 = `{SUIT-Regular, SUIT-Medium, SUIT-SemiBold, SUIT-Bold}` (4키, require로 실 TTF 매핑).
- **소비자** `src/theme/tokens.ts:187-231` typography: 실제 참조 family 집합 = `{SUIT-Bold, SUIT-Medium, SUIT-SemiBold}` (grep distinct 확인). `SUIT-Regular`는 typography에서 미참조이나 fontMap에 등록(향후/외부 대비) — **소비 집합 ⊆ 생산 집합** 성립.
- **누락 family 0건**: typography가 참조하는 모든 family가 fontMap에 존재 → "참조하는데 로드 안 됨" 케이스 없음. (역방향 SUIT-Regular 미사용은 미참조 등록일 뿐 런타임 위험 아님.)
- **App.tsx 로딩 경로** `App.tsx:16,40`: `import { fontMap } from '@/theme/fonts'` → `Font.loadAsync(fontMap)`로 네이티브 등록. 키가 곧 등록 family명이고 typography 문자열과 정확 매칭 → 경로 닫힘.

### 1-2. 인라인 리터럴 누수 (dev-notes 보고 3건 실검증) — PASS
- src 전역 `fontFamily:`/`family:` 리터럴 grep 결과 비-토큰 리터럴 3건만 잔존, **전부 SUIT-SemiBold**(Pretendard 0):
  - `src/navigation/screens/SplashView.tsx:74` `fontFamily: 'SUIT-SemiBold'`
  - `src/navigation/screens/LoginScreen.tsx:134` `fontFamily: 'SUIT-SemiBold'`
  - `src/navigation/HomeTabs.tsx:40` `fontFamily: 'SUIT-SemiBold'`
- 3건 모두 fontMap 등록 키와 정확 매칭 → 시스템 폰트 폴백되지 않음. dev-notes의 "계획 범위 보강" 보고와 일치(검증 통과).
- **src 전역 Pretendard 리터럴 0건**: 잔존 `Pretendard` 토큰은 (a) `fonts.ts:6,9` 주석(보존 메모), (b) `tokens.spec.ts:164,167` 의도된 부정 단언(`startsWith('Pretendard-')).toBe(false)`)뿐 — 실 코드 리터럴 아님.

## 2. TDD / 테스트 품질 — PASS
- **전수 단언 존재·실효성** `tokens.spec.ts:164-169`: `Object.values(typography).forEach`로 (a) 전 항목 `startsWith('SUIT-')===true`, (b) `startsWith('Pretendard-')===false` 단언. 빈 단언·항상참 아님.
- **Load-bearing 뮤테이션 검증**(표본): `tokens.ts:187` display family를 `Pretendard-Bold`로 되돌리자 해당 전수 단언이 **즉시 red**(`Tests: 1 failed, 56 passed`) → 핵심 단언이 회귀를 실제로 잡음 확인. 검증 후 원복.
- **body 계열 family 단언** `tokens.spec.ts:158-162` SUIT-Medium 명시. sectionTitle/navTitle/sheetTitle/sectionLabel/memoBody/calendar* 등 개별 family 단언도 SUIT로 갱신됨.
- **Red→Green 흐름** dev-notes:46-65에 기록(Red 9 failed → Green 1238 passed).

## 3. AC 전수 검증

| AC | 내용 | 판정 | 근거 |
|----|------|------|------|
| AC1 | fontMap SUIT 4키·Pretendard 키 0 | PASS | `fonts.ts:10-15` SUIT 4키, Pretendard 키 없음(grep `require(...SUIT` = 4건) |
| AC2 | typography 전 SUIT, Pretendard 0건 | PASS | `tokens.ts:187-231` 전 항목 SUIT-*; 전수 spec 통과; 인라인 3건도 SUIT; src Pretendard 리터럴 0 |
| AC3 | SUIT TTF 4파일 실존·유효 | PASS | `assets/fonts/SUIT-*.ttf` 4파일(589~594KB, >0); 매직넘버 전부 `00010000`; `file` 판정 "TrueType Font data, ... Version 2.040" |
| AC4 | npm test 전체 green | PASS | 138 suites / 1238 tests passed (직접 실행) |
| AC5 | tsc --noEmit 0 에러 | PASS | `TSC_EXIT=0` (직접 실행) |
| AC6 | App.tsx·architecture.md:260·fonts.ts 주석 갱신 | PASS | `App.tsx:1-2` "SUIT 폰트 로드"; `architecture.md` §7 "폰트는 SUIT(...2026-06-20 Pretendard→SUIT 전환)"; `fonts.ts:5-9` SUIT 기준 주석. 보강: HomeHeader/SplashView/LoginScreen 워드마크 주석도 SUIT |

## 4. 회귀 0 / 종료 기준 (직접 실행 출력)

`npx tsc --noEmit`:
```
TSC_EXIT=0
```

`npm test` (전체):
```
Test Suites: 138 passed, 138 total
Tests:       1238 passed, 1238 total
Snapshots:   0 total
Time:        5.994 s
```
→ dev-notes 보고(1238 green / EXIT=0)와 일치.

## 5. 컨벤션 / 시크릿 — PASS
- **useCallback/useMemo 실호출 0건**: 변경 파일(theme/, App.tsx, HomeTabs, SplashView, LoginScreen) 내 `useCallback`/`useMemo`는 전부 "지양" 주석뿐, 실 호출 없음.
- **named-object 인자**: `makeTypography({ size, ratio, family })` 객체 인자 유지(`tokens.ts:181`).
- **useEffect 명명 함수**: `App.tsx:29` `useEffect(function loadFonts(){...})` 명명 유지.
- **파일명=심볼명**: `fonts.ts`(fontMap), `tokens.ts`(themes/typography) 정합.
- **시크릿**: 폰트 다운로드 URL(jsdelivr CDN, plan.md:16) 외 비밀값 없음. .env/키 미참조.

## 6. 미검증 (런타임 영역 — 본 스프린트 범위 밖)
- SUIT 한글 글리프 실제 렌더(디바이스 스모크) — 자산 신규 추가라 Dev Client 재빌드 필요. 정합·빌드까지가 본 스프린트 종료선, 육안 확인은 사용자 재빌드 후 스모크(dev-notes·plan 명시와 일치). QA 통과 판정에 영향 없음.

## 결론
로직·통합·TDD·컨벤션 전 항목 통과. **로직 완료**로 표시 가능. 비주얼 충실도(weight↔family 매핑의 시각 정합 등)는 qa-visual 리포트 참조.
