# UI Spec — 브랜드 에셋 정합 (brand-assets)

> 날짜: 2026-06-12 · 작성: ui-publisher · 범위: UI-only(에셋·app.json·토큰). 데이터/백엔드/네비 변경 없음.
> 디자인 단일 출처: 킷 `.claude/skills/ui-design/assets/muklog-app-icon.png`(1024×1024), `muklog-splash.png`(1242×2688), `muklog-brand.card.html`.

## 1. 에셋 배치 (킷 → RN)

| 킷 원본 | RN 대상 | 방식 | 검증 |
|---|---|---|---|
| `.claude/skills/ui-design/assets/muklog-app-icon.png` (1024×1024) | `assets/muklog-app-icon.png` | `cp`(원본 보존) | SHA-256 동일: `cbbdfab1…` |
| `.claude/skills/ui-design/assets/muklog-splash.png` (1242×2688) | `assets/muklog-splash.png` | `cp`(원본 보존) | SHA-256 동일: `e04263d7…` |

- RN `assets/`에 `images/` 신규 디렉토리는 만들지 않고 루트에 배치(기존 `assets/fonts`, `assets/icons`와 동일 레벨, expo 관용 + 경로 단순). `assetBundlePatterns: ["**/*"]`로 번들 포함됨.

## 2. 앱 아이콘 (app.json)

| 항목 | 값 | 킷 출처/사유 |
|---|---|---|
| `expo.icon` | `./assets/muklog-app-icon.png` | 킷 앱 아이콘 1024² 원본. iOS는 이 한 필드로 모든 사이즈 자동 생성(브랜드 카드 소형 72/48/30 모티프 또렷 유지). |
| `expo.android.adaptiveIcon.foregroundImage` | `./assets/muklog-app-icon.png` | 동일 마크(블루 스퀘어클+흰 위치핀+포크·스푼)를 foreground로 사용. |
| `expo.android.adaptiveIcon.backgroundColor` | `#4775F0` | 킷 아이콘 블루 그라데이션(상단 `#5E86FF` → 하단 `#2851E4`, 픽셀 샘플)의 **중간 톤 근사**. adaptive 마스크가 스퀘어클 모서리를 깎을 때 드러나는 배경을 아이콘 블루와 동조시켜 어두운 링/흰 틈을 방지. (근사 항목 — §4 참조) |

> iOS adaptive 분리 불필요 — `expo.icon` 단일 필드로 충분(plan AC-1).

## 3. 스플래시 (expo-splash-screen 플러그인)

| 항목 | 변경 전 | 변경 후 | 킷 출처/사유 |
|---|---|---|---|
| `image` | (없음) | `./assets/muklog-splash.png` | 풀블리드 합성 스플래시(아이콘+"muklog" 워드마크+🍽️+"둘이 함께 쌓는 맛집 지도" 태그라인이 이미 그려진 단일 PNG). |
| `backgroundColor` | `#FFFFFF` | `#EBF1FF` | 킷 스플래시 배경은 **라이트블루→화이트 세로 그라데이션**. 픽셀 샘플 — 상단 가장자리 `#EBF1FF`~`#F2F6FF`, 하단 `#FFFFFF`. 흰 단색은 상단의 브랜드 라이트블루와 미스매치 → **상단 톤 `#EBF1FF`로 단색 근사**. (근사 항목 — §4) |
| `resizeMode` | `contain` | `contain` (유지) | 사유 §3.1 |

### 3.1 resizeMode 선택 사유 — `contain`
- 스플래시 PNG는 세로 비율 0.462(1242/2688)의 풀블리드 합성 이미지이며, 중앙에 로크업(아이콘+워드마크+태그라인)이 배치됨.
- `cover`는 화면 비율이 PNG보다 길쭉/넓을 때 상·하단을 **잘라낸다** → 태그라인/아이콘 클리핑 위험.
- `contain`은 이미지를 화면 안에 **완전히 맞춰 클리핑 0** → 중앙 로크업이 항상 온전. 비율 차로 생기는 가장자리 레터박스는 `backgroundColor`(`#EBF1FF`)가 채움.
- plan AC-3("중앙 로크업이 잘리지 않게")을 직접 충족하므로 `contain` 채택.

## 4. 근사(approximation) 항목 — RN/Expo 제약 + 사유

| # | 킷 의도 | RN 한계 | 근사 결정 | 사유 |
|---|---|---|---|---|
| A1 | 스플래시 배경 라이트블루→화이트 **그라데이션** | expo-splash-screen 네이티브 스플래시는 단색 `backgroundColor`만 지원(그라데이션 불가) | `#EBF1FF` 단색 | 합성 PNG 자체가 그라데이션을 포함하므로, `contain` 레터박스 영역만 단색으로 노출. 상단 톤 선택 → 워드마크 주변 가장 두드러진 라이트블루와 동조, 하단 흰색 영역과의 미세 경계만 근사. (`ui-publishing` 근사 허용 원칙) |
| A2 | 하단 가장자리(흰색 `#FFFFFF`)와 동시 매칭 | 단색 1개로 상·하단 두 톤 동시 매칭 불가 | 상단 톤 우선(`#EBF1FF`) | 하단 흰 영역은 레터박스가 거의 없고(이미지가 화면 높이를 대부분 채움), 상단 브랜드 라이트블루가 미스매치 시 더 눈에 띔 → 상단 우선. |
| A3 | 아이콘 블루 그라데이션(`#5E86FF`→`#2851E4`)을 Android 배경에 재현 | adaptiveIcon `backgroundColor`는 단색만 | `#4775F0`(중간 톤) | 마스크가 드러내는 모서리 영역을 아이콘 블루와 동조. 풀스퀘어 PNG가 모서리까지 채워 실제 노출은 미미하나, 라운드 마스크 대비 어두운 링 방지. |

## 5. 토큰 변경 (`src/theme/tokens.ts` + `tokens.spec.ts`)

| 토큰 | 값 | 출처 | 비고 |
|---|---|---|---|
| `palette.splashBg` | `#EBF1FF` | 킷 splash PNG 상단 가장자리 픽셀 샘플 | 원시 컬러 |
| `lightColor.splashBg` / `darkColor.splashBg` | `#EBF1FF` | `palette.splashBg` 별칭 | dark는 `...lightColor` 미러링(키 파리티 유지, 기존 다크 미러 테스트 통과) |

- `tokens.spec.ts`: `splashBg === '#EBF1FF'` 단언 추가. 기존 "다크 미러링" 테스트가 키 누락도 함께 검증.
- **출처 명시(중요):** app.json의 `backgroundColor: "#EBF1FF"`는 expo 설정 특성상 리터럴이 불가피. 동일 값을 `splashBg` 토큰으로 SSOT화하여 출처/근거를 코드에 고정(raw-hex 하드코딩 원칙 보강). app.json 값이 바뀌면 토큰도 함께 갱신.

## 6. app.json 변경 요약 (diff)

```
+  "expo.icon": "./assets/muklog-app-icon.png"
+  "expo.android.adaptiveIcon": {
+    "foregroundImage": "./assets/muklog-app-icon.png",
+    "backgroundColor": "#4775F0"
+  }
   expo-splash-screen plugin:
+    "image": "./assets/muklog-splash.png"
-    "backgroundColor": "#FFFFFF"
+    "backgroundColor": "#EBF1FF"
     "resizeMode": "contain"  (유지)
```

## 7. 회귀 (변경 없음 — 명시)
- 기존 화면·`HomeHeader` 텍스트 워드마크("먹로그"+🍽️) **불변**. 인앱 로고 SVG 마크 컴포넌트 **미도입**(로그인 스프린트로 이월).
- 데이터/훅/쿼리/네비게이션 **무변경**.

## 8. 검증 결과
- `npx tsc --noEmit` → exit 0 (통과)
- `npm test` → **52 suites / 346 tests 전부 통과** (`src/theme/tokens.spec.ts` 신규 splashBg 단언 포함). 콘솔 act() 경고는 `useMyLogs` 기존 무관 경고(실패 아님).

## 9. 비주얼 충실도 self-check (ui-publishing §5)
- [x] 색: 모든 신규 색이 토큰/명시 출처 기반(splashBg=킷 픽셀 샘플, adaptive bg=아이콘 그라데이션 중간 톤). raw-hex 임의값 없음.
- [x] 에셋: 킷 PNG 2종 byte-identical 복사(shasum 검증). 원본 보존.
- [x] 레이아웃: `resizeMode: contain`으로 중앙 로크업 클리핑 0(plan AC-3 충족).
- [x] 근사 사유 기록: 그라데이션→단색 3건(A1~A3) 사유·근거 명시(킷 충실도 "근사 허용").
- [x] 회귀: 기존 화면/헤더/토큰 키 파리티 불변(테스트 통과).
- [ ] (디바이스 스모크) 실기/시뮬레이터에서 스플래시 레터박스 톤·아이콘 마스크 모서리는 네이티브 빌드 후 육안 확인 필요 — qa-inspector/디바이스 스모크 대상.

## 10. qa-inspector 대조 포인트
- 킷 `muklog-app-icon.png` ↔ `assets/muklog-app-icon.png` (shasum) ↔ `app.json:expo.icon`.
- 킷 `muklog-splash.png` ↔ `assets/muklog-splash.png` (shasum) ↔ 플러그인 `image`.
- 킷 splash 상단 톤(`#EBF1FF`) ↔ `tokens.splashBg` ↔ `app.json` splash `backgroundColor`.
- 킷 아이콘 블루 그라데이션 ↔ `android.adaptiveIcon.backgroundColor`(`#4775F0`, 중간 톤 근사).
</content>
</invoke>
