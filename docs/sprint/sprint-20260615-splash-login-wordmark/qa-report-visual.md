# qa-report-visual — splash-login-wordmark

비주얼 충실도 QA(로직/데이터 제외). 디자인 단일 출처 킷 `.claude/skills/ui-design/templates/muklog/mk-auth.jsx` ↔ RN 동시 대조. ui-spec `docs/sprint/sprint-20260615-splash-login-wordmark/ui-spec.md` 매핑 기준 3축 검증.

## 재검증 결과 (2026-06-15) — 비주얼 완료 ✅ 통과
이전 검증의 유일 불일치였던 **🍽️ 이모지(킷 mk-auth 워드마크에 없음)**가 (A) 킷 환원으로 처리됨을 재확인. 4개 재확인 항목 전부 통과 → **비주얼 완료**.

| # | 재확인 항목 | 결과 |
|---|------------|------|
| 1 | Splash·Login 워드마크 `먹로그` 단독(🍽️ 제거, 단일 요소 환원, 레이아웃 깨짐 없음) | **통과** |
| 2 | 워드마크 폰트/letterSpacing/lineHeight·AppMark·태그라인·부제·약관·버튼 불변(회귀 0) | **통과** |
| 3 | ui-spec.md "킷에 이모지 없음"으로 정정 | **통과** |
| 4 | raw hex 0(렌더 스타일)·영문 `muklog` 잔존 0(렌더 문자열) | **통과** |

### 재확인 근거 (킷↔RN 동시 대조)
- **Splash**: 킷 `mk-auth.jsx:61-63`은 baseline div에 `먹로그` span **하나만** 포함. RN `SplashView.tsx:48-50`은 `Text variant="display"` 단일 `먹로그`만 렌더 — 🍽️ Text·`wordmarkRow` 래퍼·`wordmarkEmoji` 스타일 **전부 제거 확인**. `styles.wordmark`(`:72`)는 `{ fontSize:38, lineHeight:44, letterSpacing:-1 }` 단일 선언(이전 row/emoji 스타일 잔존 0). 워드마크는 `center` 블록 직속 자식(`:35-54`)으로 단일 요소 환원, 레이아웃 깨짐 없음(AppMark·태그라인 gap 22 정렬 유지).
- **Login**: 킷 `mk-auth.jsx:93-95`도 `먹로그` span 하나만 포함. RN `LoginScreen.tsx:72-74`는 `Text variant="emptyTitle"` 단일 `먹로그`만 렌더. `styles.wordmark`(`:132`)는 `{ fontSize:34, lineHeight:40, letterSpacing:-1 }` 단일 선언. `copyBlock`(`:71-78`) 안에서 워드마크+카피 2요소 구조 유지, 레이아웃 깨짐 없음.
- **이모지/잔존 스타일 전수**: 두 파일에 `🍽️` 0건, `wordmarkRow`/`wordmarkEmoji` 식별자 0건(읽은 전체 소스 기준). raw hex는 주석(SplashView:3·40, LoginScreen:6·7·63)에만 존재하고 렌더 스타일 값 0건. 영문 `muklog`는 파일 경로 주석(SplashView:1, LoginScreen:1)에만 존재하고 렌더 문자열 0건.
- **불변(회귀 0)**: 워드마크 폰트(display·emptyTitle→Pretendard-Bold)·letterSpacing(-1)·lineHeight(44/40 보정)·AppMark(120/108, radius 32/28, accentShadow 근사)·태그라인(`둘이 함께 쌓는 맛집 지도`)·부제(`LOGIN_COPY`)·약관(밑줄 2개)·소셜버튼·그라데이션 모두 이전 검증값과 동일(변경 없음).
- **ui-spec 정정 확인**: `ui-spec.md:12-13` 킷 스펙란이 **"이모지 없음 — AppMark가 플레이풀 요소 담당"**으로, `:15`에 qa-visual 후속 정정 노트(🍽️ Text·`wordmarkRow`/`wordmarkEmoji` 제거 경위) 기록됨. 킷 미존재 요소가 킷 정합으로 오기되던 문제 해소.

---

## (이력) 이전 검증 요약
- **워드마크 한글화(핵심 목표): 통과.** Splash·Login·HomeHeader 세 워드마크 모두 한글 `먹로그`, Pretendard-Bold(킷 800) 동일 글리프/굵기, 크기(38/34/26)·letterSpacing(-1/-1/-0.5)·lineHeight 보정 정합. 앱 전역 일관 확보.
- **회귀(태그라인·부제·약관·소셜버튼·그라데이션·AppMark): 통과(불변 확인).**
- **카피·토큰: 통과.** 렌더 문자열에 raw hex 0, 영문 `muklog` 잔존 0(코멘트에만 존재).
- **~~불일치 1건(중요도 중): 🍽️ 이모지~~ → 해소(2026-06-15 재검증, 위 참조).** 킷 환원(A) 적용 완료.

---

## ① 레이아웃·구조 / safe-area

| 항목 | 킷 | RN | 판정 |
|------|----|----|------|
| Splash 전체 center + gap 22 | mk-auth:54-57 | SplashView.tsx:70-71 (`root` center, `center` gap 22) | 통과 |
| Splash 스피너 하단 absolute bottom 54 | mk-auth:67-69 | SplashView.tsx:81 (`spinner` absolute bottom 54) | 통과 |
| Login 상단 비주얼 flex 1·center·gap 20·padding 0 32 | mk-auth:87-90 | LoginScreen.tsx:124-130 (`visual`) | 통과 |
| Login 하단 actions flex none·padding 0 24 40·gap 11 | mk-auth:103 | LoginScreen.tsx:141 (`actions` paddingBottom 40 gap 11) | 통과 |
| safe-area | (웹 N/A) | LoginScreen.tsx:49 `edges=['top','bottom']`, 하단 padding 40 추가 — inset 이중 적용 아님(SafeAreaView가 inset, padding은 킷 여백). Splash는 SafeArea 없이 전체 center(로딩 화면, 안전영역 무관) | 통과 |
| 워드마크/이모지 baseline row | mk-auth:61(gap8)/93(gap7) | SplashView:75 gap8 / LoginScreen:135 gap7 | 통과(아래 ② 이모지 별도) |

## ② 비주얼·토큰

| 항목 | 킷 | RN | 판정 |
|------|----|----|------|
| 워드마크 폰트 800 | mk-auth:62/94 `800` | display·emptyTitle 모두 `Pretendard-Bold`(tokens.ts:140,153) = HomeHeader wordmark(tokens.ts:151)와 동일 weight | 통과 |
| 워드마크 크기 | Splash 38 / Login 34 | SplashView:76 `fontSize:38` / LoginScreen:136 `fontSize:34` | 통과 |
| letterSpacing | `-0.03em` | -1 근사(38×-0.03≈-1.14, 34×-0.03≈-1.02). HomeHeader 밀착 정책 미러 | 근사 허용(ui-spec:18 사유 기록) |
| lineHeight | `/1`(=fontSize) | 44/40(×1.15) — RN 한글 글리프 클리핑 방지 | 근사 허용(ui-spec:19 사유 기록, baseline 정렬 불변) |
| 색(워드마크) | `--mk-ink`(#2A2422) | `color="fg"`=warm.ink #2A2422(tokens.ts:73) | 통과 |
| AppMark 컬러 그림자 | boxShadow rgba(42,85,230,.28/.26) | accentShadow 토큰 근사(SplashView:42-45 / LoginScreen:64-67) | 근사 허용(iOS 충실, 사유 기록 SplashView:9·LoginScreen:7) |
| 그라데이션 | linear 160deg #EAF0FF→#FFF | authVisualGradient 토큰 + 대각 start/end 근사 | 근사 허용(사유 기록) |
| 소셜버튼 radius/보더 | radius-btn(14), google 1px line-strong, apple 무테 | SocialButton:85-89 radius.control(14)·hairline lineStrong·apple 0 — **그림자 아닌 헤어라인 보더** | 통과 |
| raw hex(렌더 스타일) | — | SplashView/LoginScreen 스타일 값에 raw hex 0건(hex는 코멘트·SSOT tokens.ts에만) | 통과 |

## ③ 텍스트·카피

| 항목 | 킷 | RN | 판정 |
|------|----|----|------|
| 워드마크 텍스트 | `먹로그`(mk-auth:62,94) | `먹로그`(SplashView:50, LoginScreen:74) | 통과 |
| Splash 태그라인 | `둘이 함께 쌓는 맛집 지도`(mk-auth:65) | SplashView:18 SPLASH_TAGLINE 동일 | 통과(불변) |
| Login 부제 | `데이트하며 다닌 맛집을<br/>사진·메모·위치로 둘이 함께 기록해요.`(mk-auth:97) | LoginScreen:32 LOGIN_COPY `\n` 변환 동일 | 통과(불변) |
| 약관 문구 | `계속하면 서비스 약관 및 개인정보 처리방침에 동의하는 것으로 간주돼요.`(mk-auth:107) | LoginScreen:106-114 동일(밑줄 2개) | 통과(불변) |
| 소셜버튼 카피 | `Apple로 계속하기`/`Google로 계속하기`(mk-auth:134) | SocialButton:117 동일 | 통과(불변) |
| 영문 `muklog` 잔존 | — | 렌더 문자열 0건(코멘트 SplashView:3 등에만) | 통과 |

---

## 불일치 (→ ui-publisher 확인·결정 필요)

### [중] 🍽️ 이모지 — 킷 mk-auth splash/login 워드마크에는 이모지가 없음
- **킷 근거:** `mk-auth.jsx:61-63`(Splash) 및 `:93-95`(Login)의 baseline row는 `먹로그` span **하나만** 포함. `Wordmark` 헬퍼(:44-46)도 `먹로그` span만 렌더(이모지 없음). 즉 mk-auth 전체에 워드마크 옆 🍽️ 이모지가 **존재하지 않음**. 스플래시/로그인에서 플레이풀 요소는 워드마크 위의 AppMark(SVG 핀+포크/스푼)가 담당.
- **RN 현황:** `SplashView.tsx:52` `🍽️ fontSize:26`, `LoginScreen.tsx:76` `🍽️ fontSize:23`를 워드마크 옆에 추가 렌더.
- **ui-spec 표기 문제:** ui-spec.md:12-13·22가 "옆 🍽️ baseline row"를 킷 스펙처럼 기술하나 mk-auth에는 근거 라인 없음(킷 미존재 요소를 킷 정합으로 표기).
- **판단 근거(양면):** muklog 플레이풀 예외상 이모지 자체는 허용 요소이고, HomeHeader(mk-home)는 워드마크 옆 🍽️를 가짐 → "앱 전역 일관" 논리로 splash/login에도 넣었을 수 있음. 그러나 **킷이 곧 디자인 기준**이며 mk-auth는 의도적으로 이모지 없이 AppMark만 둔 화면이므로, 현 RN은 킷 시안과 다른 비주얼.
- **수정안(택1, ui-publisher 결정):**
  - (A) 킷 충실: `SplashView.tsx:52`·`LoginScreen.tsx:76`의 `🍽️` Text 및 `wordmarkRow`를 단일 워드마크 텍스트로 환원(킷 mk-auth:62/94 그대로). `wordmarkEmoji` 스타일 제거. → 시안 100% 정합.
  - (B) 의도적 유지(앱 일관 우선): 사용자/디자인 결정으로 splash/login에도 이모지를 추가한 것이라면, **ui-spec.md:12-13,22의 킷 라인 표기를 정정**("킷 mk-auth에는 이모지 없음 — 앱 전역 HomeHeader 일관을 위해 의도적 추가, 결정자/사유 명시")해 킷 미존재 요소가 킷 정합으로 오기되지 않게 한다.
- **권고:** 디자인 단일 출처 원칙상 (A)를 기본 권고. (B)를 택할 경우 ui-spec 정정 필수.

---

## 근사 허용 (RN 한계 — 사유 기록 확인됨)
- letterSpacing -0.03em → -1(ui-spec:18).
- lineHeight /1 → ×1.15 한글 클리핑 보정(ui-spec:19, baseline 정렬 불변).
- AppMark 컬러 그림자 → accentShadow 토큰 근사, iOS 충실/Android elevation(SplashView:9·LoginScreen:7).
- 그라데이션 160deg·진입 애니메이션(mkPop/mkFade)·Spinner 회전 → 정적+ActivityIndicator 근사(SplashView:6-8).

## 미검증
- 실기기/시뮬레이터 런타임 렌더(글리프 실제 클리핑·🍽️ baseline 시각 정렬·iOS 컬러 그림자 발색)는 정적 코드 대조 범위 밖. 라이브 스모크 권고(특히 lineHeight 보정 후 `먹로그` 상/하단 잘림 없음 육안 확인).

## 비주얼 완료 여부
**비주얼 완료 ✅** (2026-06-15 재검증). 🍽️ 이모지 불일치가 (A) 킷 환원으로 해소되고 ui-spec도 정정됨. Splash·Login 워드마크 `먹로그` 단독·회귀 0·raw hex 0·영문 잔존 0 전부 통과. 잔여 불일치 없음.
