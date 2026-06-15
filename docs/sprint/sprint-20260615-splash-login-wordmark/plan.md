# Sprint: splash-login-wordmark — 스플래시/로그인 워드마크 한글화

> 사용자가 업데이트한 디자인 킷 `templates/muklog`(`mk-auth.jsx`)을 단일 출처로, 스플래시·로그인 화면의 **워드마크를 영문 `muklog` → 한글 `먹로그`** 로 정합한다. **단일 기능(문구 변경)만**. 로그(방) 이름·지도 현재위치 버튼은 별도 후속 스프린트(큐잉됨), 이번 범위 아님.

## 1. 기능 한줄 정의
스플래시(SplashView)·로그인(LoginScreen) 화면의 브랜드 워드마크를 킷과 동일한 한글 `먹로그`로 표기한다.

## 2. 범위
### In-scope
- `src/navigation/screens/SplashView.tsx` 워드마크 텍스트 `muklog` → `먹로그` (킷 mk-auth.jsx:62).
- `src/navigation/screens/LoginScreen.tsx` 워드마크 텍스트 `muklog` → `먹로그` (킷 mk-auth.jsx:94).
- 한글 글리프에 맞는 워드마크 **스타일 정합**(fontFamily/weight/letterSpacing/lineHeight) — 킷 `800 38px/1 letterSpacing -0.03em`(splash)·`800 34px/1`(login). **기존 `HomeHeader`의 `먹로그` 워드마크 처리(DEFAULT_WORDMARK)를 미러**해 일관성 확보.
- 워드마크 옆 🍽️ 이모지·배치(baseline row)는 킷대로 유지.
- 카피 텍스트가 바뀌는 테스트(`*.spec.tsx`)가 있으면 `먹로그`로 갱신.

### Out-of-scope (이미 일치 — 변경 금지)
- ❌ 스플래시 태그라인 `둘이 함께 쌓는 맛집 지도`(킷과 일치).
- ❌ 로그인 부제 `데이트하며 다닌 맛집을 / 사진·메모·위치로 둘이 함께 기록해요.`(일치).
- ❌ 로그인 약관 문구(일치).
- ❌ 데이터·계약·네비게이션·로직 변경(회귀 0). 로그 이름/지도 현재위치 버튼(후속).

## 3. 데이터·API 계약
- **변경 없음.** 순수 화면 텍스트/스타일만.

## 4. 화면·UX
- 킷 단일 출처: `mk-auth.jsx`(SplashScreen 53-72 / LoginScreen 83-111). 워드마크만 한글로, 나머지 레이아웃·간격·이모지 불변.

## 5. 작업 목록 (인수조건)
- [ ] SplashView 워드마크 `먹로그` — 인수조건: 화면에 `먹로그` 렌더, `muklog` 미존재, 한글 글리프 잘림/베이스라인 깨짐 없음(스타일 정합). T: SplashView 렌더 `먹로그` 단언.
- [ ] LoginScreen 워드마크 `먹로그` — 인수조건: 동일. T: LoginScreen 렌더 `먹로그` 단언(+기존 카피 회귀).
- [ ] 회귀: `npm test` 전체 통과 + `tsc --noEmit`. 태그라인/부제/약관 불변.

## 5-1. 테스트 케이스 (TDD)
- SplashView: `먹로그` 텍스트 존재, 태그라인 불변.
- LoginScreen: `먹로그` 텍스트 존재, 부제/약관 불변, Apple/Google 버튼 불변.

## 6. 엣지케이스
- 한글 워드마크 lineHeight/letterSpacing가 영문 튜닝값(letterSpacing -1, lineHeight 38)과 달라 글리프가 잘릴 수 있음 → 킷 값 + HomeHeader 선례로 정합.

## 7. QA 교차검증 경계면
| 생산자(킷) | 소비자(RN) | 검증 |
|--------|--------|------|
| mk-auth.jsx:62/94 `먹로그` | SplashView/LoginScreen 워드마크 | 텍스트·폰트·간격 정합 |
| 기존 태그라인/부제/약관 | 동일 화면 | 불변(회귀 0) |

## 8. 비용 가드레일
- 해당 없음(순수 텍스트). 네트워크/DB/AWS 변화 0.

## 9. 핸드오프
- **ui-publisher**: 워드마크 한글 정합(킷 충실 + HomeHeader 미러) + 테스트.
- **qa-visual**: 킷 대비 워드마크 충실도(폰트/간격/이모지) + 태그라인·부제·약관 불변.
- **qa-logic(게이트)**: 전체 테스트·tsc 회귀 0(데이터·계약 불변).
