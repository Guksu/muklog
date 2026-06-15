# ui-spec — splash-login-wordmark

스플래시/로그인 워드마크를 영문 `muklog` → 한글 `먹로그`로 킷 정합. 순수 비주얼/텍스트 변경(데이터·로직·계약 불변).

## 단일 출처
킷 `.claude/skills/ui-design/templates/muklog/mk-auth.jsx`.

## 킷 라인 ↔ RN 매핑

| 화면 | 킷 라인 | 킷 스펙 | RN 파일 | RN 매핑 |
|------|---------|---------|---------|---------|
| Splash | `mk-auth.jsx:61-63` | `먹로그` 단독 `font:800 38px/1` `letterSpacing -0.03em`. **이모지 없음** — 워드마크 위 AppMark가 플레이풀 요소 담당 | `src/navigation/screens/SplashView.tsx` 워드마크 Text + `styles.wordmark` | `Text variant="display"`(Pretendard-Bold) + `styles.wordmark { fontSize:38, lineHeight:44, letterSpacing:-1 }` (단독, row/이모지 없음) |
| Login | `mk-auth.jsx:93-95` | `먹로그` 단독 `font:800 34px/1` `letterSpacing -0.03em`. **이모지 없음** — AppMark가 플레이풀 요소 담당 | `src/navigation/screens/LoginScreen.tsx` 워드마크 Text + `styles.wordmark` | `Text variant="emptyTitle"`(Pretendard-Bold) + `styles.wordmark { fontSize:34, lineHeight:40, letterSpacing:-1 }` (단독, row/이모지 없음) |

> qa-visual 후속 정정(2026-06-15): 킷 splash(61-63)·login(93-95)의 워드마크 span에는 🍽️ 이모지가 없다. AppMark(워드마크 위 블루 마크)가 플레이풀 요소를 담당하므로 워드마크는 `먹로그` 단독. 초기 RN이 추가로 렌더하던 🍽️ Text와 `wordmarkRow`/`wordmarkEmoji` 스타일을 제거해 킷과 일치시켰다.

## 워드마크 폰트/간격 정합 근거 (HomeHeader 미러)

- **fontFamily/weight**: 앱 전역 워드마크 일관성을 위해 `HomeHeader.tsx`의 `먹로그`(DEFAULT_WORDMARK, `variant="wordmark"` → `Pretendard-Bold`)를 기준으로 미러. Splash의 `display`·Login의 `emptyTitle` 변형도 모두 `Pretendard-Bold`(tokens.ts:140,153)로 동일 weight 해석 → 세 워드마크가 같은 글리프/굵기로 렌더. 킷 `800`은 Pretendard-Bold로 매핑(킷 폰트스택 단일 출처 기존 규칙 동일).
- **letterSpacing**: 킷 `-0.03em` → Splash 38×(-0.03)≈-1.14, Login 34×(-0.03)≈-1.02 → 둘 다 `-1`로 근사(HomeHeader의 밀착 letterSpacing 정책 미러). 한글 워드마크의 자간 밀착감 유지.
- **lineHeight(한글 글리프 클리핑 방지)**: 킷은 `/1`(lineHeight=fontSize)이나, RN에서 한글 글리프는 라틴(`muklog`)보다 수직 공간을 더 요구해 `lineHeight=fontSize`면 상/하단 클리핑·베이스라인 깨짐 위험. → Splash `lineHeight:44`(38×1.15 근사), Login `lineHeight:40`(34×1.15 근사)로 보정.

## 불변 항목(회귀 0)
- Splash 태그라인 `둘이 함께 쌓는 맛집 지도`(SPLASH_TAGLINE) 불변.
- Login 부제 `LOGIN_COPY`·약관 문구·Apple/Google 버튼·그라데이션·AppMark·스피너 불변.
- 데이터·로직·네비게이션·props 계약 불변.

## 검증
- `npx jest SplashView.spec LoginScreen.spec` → 10 passed (워드마크 단언 `먹로그`로 갱신, 태그라인/부제/약관/버튼 회귀 단언 유지).
- `npx tsc --noEmit` → clean.
