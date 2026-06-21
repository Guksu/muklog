# QA Report — Visual (sprint-20260620-font-suit)

폰트 Pretendard → SUIT 전환. **킷(SSOT) = `templates/muklog`** (SUIT 로드·`softFont:true` 기본). 비주얼 충실도만 검증, 코드 수정 없음.

> 본 스프린트는 화면 골격·색·radius·간격 변경이 없는 **typography family 문자열 전환**이므로, 3축 중 ②비주얼·토큰(폰트 패밀리/웨이트)에 집중하고 ③메트릭 불변을 확인한다. 한글 글리프 실렌더 차이는 디바이스 스모크(런타임) 영역 — 정합·빌드까지가 본 검증 범위.

## 종합 판정: **통과 (근사 1건 허용)**

ui-spec 체크리스트 4항목 + plan 인수조건 비주얼 관련 전부 충족. 킷 의도(SUIT 우선) 대비 RN 단일 family 근사는 ui-spec에 기록·합리적 → 근사 허용.

---

## 항목별 결과

### ① typography 전 항목 family = `SUIT-*` (Pretendard 잔존 0) — 통과
- `src/theme/tokens.ts:186-232` typography ~40종 전 항목 `fontFamily`가 `SUIT-`로 시작. distinct family = `SUIT-Bold` / `SUIT-SemiBold` / `SUIT-Medium`.
- `grep -rn "Pretendard" src/` 결과 잔존 4건은 **전부 주석·테스트 단언 문자열**(`fonts.ts:6,9` 보존 메모 / `tokens.spec.ts:164,167` "Pretendard 잔존 0건" 단언) — 기능 참조 0건.
- 킷 근거: `index.html:89-91` `--font-sans` SUIT 우선.

### ② weight ↔ family 매핑 = 치환표 일치 — 통과
- weight 주석이 달린 30개 토큰 전수 검증: 800/700→`SUIT-Bold`, 600→`SUIT-SemiBold`, 500→`SUIT-Medium` **위반 0건**.
- weight 의미 보존 표본: `cardTitle` 700→SUIT-Bold(`:199`), `wordmark` 800→SUIT-Bold(`:198`), `dialogInput` 600→SUIT-SemiBold(`:219`), `calendarDow` 700→SUIT-Bold(`:222`), `memoBody` 500→SUIT-Medium(`:212`) — 모두 기존 Pretendard 구조 1:1 보존(접두만 치환).
- body 계열(body/bodyLg/bodySm/caption/sectionCaption/meta 등)은 weight 주석 없이 `SUIT-Medium` — ui-design "Medium = 본문 기본" 규칙 정합(`:191` 주석 명시).

### ③ 메트릭 불변 (fontSize/lineHeight/ratio) — 통과
- `makeTypography` 시그니처·계산식 불변(`:181-185`): `fontSize:size`, `lineHeight:Math.round(size*ratio)`. family 인자만 변경.
- 전 토큰 size/ratio 값 그대로(예: display 40/1.2, cardTitle 17/1.3, inviteCode 26 등). 폰트만 교체, 크기 변형 0.

### ④ fontMap 키 ↔ typography family 1:1 (누락/dangling 0) — 통과
- `src/theme/fonts.ts:10-15` fontMap 키 4종: `SUIT-Regular/Medium/SemiBold/Bold`. Pretendard 키 0.
- typography + 인라인이 참조하는 family 3종(Bold/SemiBold/Medium) **전부 fontMap에 존재 → 누락 0**.
- `SUIT-Regular`는 typography 미참조이나 fontMap 등록 유지(dev-notes 명시: 향후/외부 사용 대비) — dangling이 아니라 의도된 여유 등록. expo-font 등록 비용만이고 비주얼 영향 0 → 허용.

### ⑤ src 전역 인라인 fontFamily 리터럴 Pretendard 잔존 0 — 통과
- `grep -rn "fontFamily:[[:space:]]*['\"]" src/` 결과 3건 전부 SUIT:
  - `src/navigation/HomeTabs.tsx:40` → `'SUIT-SemiBold'`
  - `src/navigation/screens/SplashView.tsx:74` → `'SUIT-SemiBold'`
  - `src/navigation/screens/LoginScreen.tsx:134` → `'SUIT-SemiBold'`
- dev-notes 보고(HomeTabs/SplashView/LoginScreen 3건 정합)와 실 grep 일치. fontMap에서 Pretendard 키 제거 후 이 리터럴이 미등록 family를 가리켜 시스템 폰트로 폴백되는 잠복 결함을 dev가 선제 차단 — 정합 확인.

### ⑥ SUIT TTF 4종 실존·유효 — 통과
- `assets/fonts/SUIT-{Regular,Medium,SemiBold,Bold}.ttf` 4파일 실존, 크기 > 0(589,892~594,324 B, dev-notes 기재값 일치).
- 매직넘버 4파일 전부 `00010000`(TrueType). `file` 판정 "TrueType Font data, Version 2.040", 패밀리명이 키와 일치(`SUIT-Bold`/`SUIT-Medium`/`SUIT-Regular`/`SUIT-SemiBold`).

### ⑦ 킷 의도(SUIT 우선) 대비 RN 단일 family 근사 — 근사 허용
- 킷 `index.html:89-91` `--font-sans`는 다단 폴백(`SUIT Variable → Pretendard JP → Pretendard → system`)이고 `softFont:true`가 기본(`:71`). README도 SUIT 명시(`:106`, `:74`).
- RN `fontFamily`는 단일 정확 매칭이라 글리프 단위 폴백 불가 → typography를 단일 `SUIT-*`로 지정하고, 폰트 **로드 실패 시에만** `App.tsx` `Font.loadAsync().catch()`로 시스템 폰트 진입.
- ui-spec.md:24-26에 "킷 의도(SUIT 우선)의 합리적 RN 근사"로 명문 기록 + 정적 TTF↔가변폰트 weight 인스턴스 차이(Pretendard와 동일 4단 정책)도 기록됨. **근사 사유 합리·기록 완비 → 근사 허용으로 통과 처리.**

---

## 불일치 / 미검증
- **불일치: 없음.** ui-publisher 라우팅 불필요.
- **미검증(런타임·사용자 영역):** SUIT 한글 글리프 실렌더 외형(자형·자간)은 디바이스 스모크 영역. 자산 신규 추가라 Dev Client 재빌드 후 육안 확인 필요 — 사용자 안내(통과 처리 아님, 본 스프린트 정합·빌드 범위 밖).

## 비주얼 완료 여부
typography·인라인·fontMap·자산 4축의 SUIT 정합이 전수 통과. 비주얼 충실도 기준 **스프린트 비주얼 완료 가능**(디바이스 글리프 스모크는 사용자 재빌드 후 권장).
