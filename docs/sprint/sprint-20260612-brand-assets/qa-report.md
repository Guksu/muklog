# QA Report — 브랜드 에셋 정합 (brand-assets)

> 날짜: 2026-06-12 · 검증: qa-inspector · 범위: UI-only(에셋·app.json·토큰). 데이터/훅/경계면 없음 → 설정 정합성 + 킷 비주얼 충실도 교차검증.
> 방법: shasum byte-identity, 킷/RN PNG 픽셀 샘플(sips), tsc/test 직접 재실행, app.json↔토큰 SSOT 대조.

## 종합

| AC | 항목 | 판정 |
|----|------|------|
| AC-1 | 앱 아이콘 (icon + android adaptiveIcon) | 통과 |
| AC-2 | 스플래시 이미지 + backgroundColor | 통과 |
| AC-3 | resizeMode(contain) 사유 | 통과 |
| AC-4 | 스플래시 배경 토큰(splashBg) + spec | 통과 |
| AC-5 | 회귀 없음 (tsc / test / HomeHeader 불변) | 통과 |
| - | 컨벤션(raw-hex 팔레트 경유) | 통과 |
| - | 스코프 경계(auth/logo 미포함) | 통과(주의 1건) |

전부 통과. 단, 스코프 외 결함 1건(orchestrator SKILL.md 킷 경로 회귀)과 문서 정확성 결함 1건(ui-spec shasum 표기 오류)을 발견 — **둘 다 브랜드 에셋 런타임에는 무영향**.

---

## AC-1 앱 아이콘 — 통과

- **byte-identity**: 킷 `muklog-app-icon.png` ↔ `assets/muklog-app-icon.png` SHA-256 동일
  `cbbdfab1b4b9f90b36c1c0879efd5ce8d24b065bf83a37f7200f9864688fc22f` (양쪽). 1024×1024 RGBA 원본. 통과.
- **경로 유효**: `app.json:10` `expo.icon: "./assets/muklog-app-icon.png"` → 실파일 존재. 통과.
- **Android adaptiveIcon** (`app.json:20-23`): `foregroundImage` 동일 파일 가리킴(유효). `backgroundColor:#4775F0`.
  - 교차검증(아이콘 그라데이션 픽셀 샘플): top `#5680FC` → mid `#426CF2` → bottom `#2F59E8`.
  - `#4775F0`은 top~mid 사이 중간 톤 — 그라데이션 밴드 내부에 위치. 라운드 마스크가 모서리를 깎아도 어두운 링/흰 틈 없이 아이콘 블루와 동조. ui-spec §4 A3 주장 타당. 통과.
- **비주얼**(킷 PNG 육안): 블루 스퀘어클 + 흰 위치핀 안 포크·스푼 모티프. plan AC-1 명세 일치.
- 미검증(디바이스 스모크): 실기 홈스크린 소형(72/48/30) 또렷도 — 네이티브 빌드 후 육안 필요.

## AC-2 / AC-3 스플래시 — 통과

- **byte-identity**: 킷 `muklog-splash.png` ↔ `assets/muklog-splash.png` SHA-256 동일
  `e04263d77c98b2ebfa602591474dd8cf0d966e21f404dc9ff36bb96dfe2214bf` (양쪽). 1242×2688 RGBA. 통과.
- **경로 유효**: `app.json:31` 플러그인 `image: "./assets/muklog-splash.png"` → 실파일 존재. `expo-splash-screen@~0.29.0` 설치 확인. 통과.
- **backgroundColor 교차검증** (#EBF1FF): RN/킷 splash PNG 직접 픽셀 샘플 —
  - top-left `#EAF0FF`, top-center `#EEF3FF`, top-right `#F1F5FF` (상단 = 라이트블루 그라데이션)
  - mid-left `#FDFEFF`, bottom-center `#FFFFFF` (하단 = 화이트)
  - 채택값 `#EBF1FF`는 상단 가장자리 범위(`#EAF0FF`~`#EEF3FF`) **내부**에 정확히 위치. ui-publisher의 "상단 라이트블루 #EBF1FF" 주장 검증됨. 단색→그라데이션 근사로 합리적. 통과.
- **resizeMode `contain`** (`app.json:33`): 세로비 0.462 풀블리드 합성 PNG의 중앙 로크업(아이콘+워드마크+태그라인) 클리핑 0 보장. `cover`였다면 상·하단 잘림 위험. ui-spec §3.1 사유 타당. 통과.
- 미검증(디바이스 스모크): 실기 스플래시 레터박스 톤 경계(#EBF1FF 단색 vs 이미지 상단 라이트블루의 미세 경계) 육안 확인 — 네이티브 빌드 후.

## AC-4 토큰 — 통과

- `tokens.ts:33` `palette.splashBg:'#EBF1FF'` (원시 컬러, 출처 주석 명시).
- `tokens.ts:57` `lightColor.splashBg: palette.splashBg` (팔레트 경유 — raw-hex 하드코딩 없음).
- **다크 키-파리티**: `darkColor`는 `...lightColor` 스프레드(`tokens.ts:62`)로 `splashBg` 자동 미러. spec `tokens.spec.ts:90-95` "다크 미러링" 테스트(light/dark 키집합 동일)가 누락 동시 검증 — 통과.
- **spec 단언**: `tokens.spec.ts:76-80` `splashBg === '#EBF1FF'` 직접 단언 추가. 값 깨지면 빨개지는 의미 있는 단언. 통과.
- **SSOT 일관성**: app.json `backgroundColor:"#EBF1FF"`(L32) === `palette.splashBg`(L33) === spec 단언값. 세 곳 동일. 통과.

## AC-5 회귀 — 통과 (직접 재실행)

- `npx tsc --noEmit` → **exit 0**.
- `npm test` → **52 suites / 346 tests 전부 통과** (2.5s). 신규 splashBg 단언 포함. ui-spec §8 주장과 일치.
- `HomeHeader.tsx` 미변경 확인(`git diff HEAD` 빈 결과) + `HomeHeader.spec.tsx` 통과 — 텍스트 워드마크 불변. 통과.

## 컨벤션 — 통과

- 변경 ts(`tokens.ts`/`tokens.spec.ts`)의 신규 색은 `palette` 경유. lightColor/darkColor에 raw-hex 직타 없음. plan AC-4 "raw hex 하드코딩 금지" 충족.
- app.json의 `#EBF1FF`/`#4775F0` 리터럴은 expo 설정 특성상 불가피(JSON, 토큰 import 불가) — splashBg 토큰으로 SSOT 고정해 근거 코드화. 합리적.

---

## 스코프 외 발견 (브랜드 에셋 런타임 무영향 — 보고만)

### [경미·범위밖] D1 — orchestrator SKILL.md 킷 경로 회귀
- 파일: `.claude/skills/sprint-orchestrator/SKILL.md` (이번 작업 트리에 함께 staged됨, `git status`로 확인)
- 내용: 디자인 단일 출처 경로를 `ui_kits/muklog` → `templates/muklog`로 **되돌림**.
- 문제: CLAUDE.md / qa-inspector.md / ui-publisher 역할 정의는 모두 `ui_kits/muklog`(`.claude/skills/ui-design/ui_kits/muklog/`)를 단일 출처로 명문화. SKILL.md만 `templates/muklog`로 어긋남 → 향후 스프린트에서 ui-publisher가 잘못된 경로를 참조할 위험.
- 본 스프린트(brand-assets)와 무관한 변경(에셋 출처는 `ui_kits`가 아니라 `assets/`라 이번 검증엔 무영향).
- 수정 방향: 의도된 경로 전환이면 CLAUDE.md/에이전트 정의까지 일괄 갱신, 아니면 SKILL.md 변경을 되돌릴 것. → 라우팅: 본 스프린트 외, 사용자/오케스트레이터 판단 필요.

### [경미·문서] D2 — ui-spec.md shasum 표기 오류
- 파일: `docs/sprint/sprint-20260612-brand-assets/ui-spec.md:10-11`
- 내용: 검증 컬럼이 app-icon `02c5e815…`, splash `262c5975…`로 기재됐으나 실제 SHA-256은 `cbbdfab1…` / `e04263d7…`.
- 영향: 실제 파일은 **byte-identical(통과)** 이므로 에셋 자체엔 무결함. 문서의 해시 표기만 틀림(다른 해시 알고리즘/이전 파일 기준으로 추정). 추적성 혼란 소지.
- 수정 방향(ui-publisher): ui-spec.md 해시 표기를 SHA-256 실측값으로 갱신. → 라우팅: ui-publisher.

### 스코프 클린 확인
- auth(mk-auth) 화면·인앱 로고 SVG 파일 신규 추가 **없음**(`git status` grep 결과 0건). plan 제외 항목 준수.

---

## 종료 판정

**전체 통과** — AC-1~5 모두 통과(tsc 0 / 346 tests pass / byte-identity·픽셀·SSOT 교차검증 완료). 디바이스 스모크 2건(아이콘 소형 또렷도·스플래시 레터박스 톤)은 네이티브 빌드 후 육안 "미검증"으로 잔존. 스코프 외 경미 결함 2건(D1 SKILL.md 경로 회귀, D2 ui-spec 해시 표기)은 브랜드 에셋 런타임 무영향 — 별도 처리 권고.
