# Dev Notes: 지도 핀 클러스터링 (map-clustering)

> 작성: dev-map-cluster · 2026-08-13
> 계획 단일 출처: `docs/sprint/sprint-20260813-map-clustering/plan.md`
> 결과: **Path A(WebView 내 Kakao `MarkerClusterer`) 코드 구현 완료 — R2(qa-logic 반영) 기준 `npm test` 1993 green · `tsc --noEmit` 0.**
> ⚠️ **T0 실기기 스파이크는 미실행(이월).** 이 환경에서 dev build·실기기 관찰이 불가능하다. 아래 §1 참조.

---

## 0. 변경 파일 (전량) + 체크섬(SHA-256)

> **R2 갱신(qa-logic 1차 리포트 반영)**: L1 중대 회귀 수정 + L2·L3·L4 단언 보강.
> **R3 갱신(qa-logic 재검증 리포트 반영)**: L5 폐기 경로 개수 잠금 1줄 추가(코드 변경 0). 둘 다 아래 §8 참조.

| 파일 | 성격 | SHA-256 (R3, qa-logic 재검증 반영 후) |
|---|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | 프로덕션 (이 스프린트의 **유일한** 프로덕션 변경) | `cfe7e442d82652a383ae6659c9e267706093fd7199312ff14435af41ae0fb725` (R2와 동일 — R3는 spec만 변경) |
| `src/features/map/mapHtml/mapHtml.spec.ts` | 단위 테스트 증분 (+13건, R3에서 단언 1줄 보강) | `78a82d16b9b473d1cef2372960718563f040f523e413d0d547463064522a3961` |
| `docs/design/architecture.md` | 백로그 행 추가 + `map-tab-nearby` 행 "클러스터링 OUT" 해소 표기 (T9) + **재-INIT 성질 보강**(qa-logic §3.12 권고) | `f96dfa6bbaafe489c3afdf0a4017c86a2cf82f5cb289aab85515bb2d10b1a743` |

<sub>R1 체크섬(참고): `mapHtml.ts` `0a521613…97e8eb` · `mapHtml.spec.ts` `58d5b4f5…276266`.</sub>

**변경 0 확인(계획 §3.0 전제)**: `types.ts`(`MapMarker`·`MapInboundType`·`MapOutboundType`) · `parseMapMessage` · `mapMessages` · `pinsToMapMarkers` · `wishToMapMarkers` · `nearbyToMapMarkers` · `mergeMapMarkers` · `MapTabScreen.tsx` · `MapWebView` · `MapPrewarm` · `supabase/` · `package.json` — **전부 미변경**(`git status` 상 위 3개 파일 외 소스 변경 없음). 신규 의존성 0.

**최종 테스트 수(R2)**: `npm test` = **198 suites / 1993 tests, 전량 green**. `mapHtml.spec.ts` 단독 = **42 tests**(기존 29 + 증분 13). `npx tsc --noEmit` = 오류 0. 추가로 생성된 WebView 스크립트를 `node --check`로 문법 검증(통과, ES6 토큰 유입 0) — 템플릿 안 JS는 어떤 파서도 검증하지 않아 문법 오류가 문자열 단언을 그대로 통과하기 때문이다.

---

## 1. T0 스파이크 판정 — **미판정(실기기 이월, 최우선 항목)**

계획 §5 T0는 "실기기 dev build에서 클러스터 버블·핀 흡수·탭 줌인 3개 관찰"이 게이트다. 이 세션은 실기기·dev build·Metro 콘솔에 접근할 수 없으므로 **판정을 내리지 않았다**(관찰 없이 "호환됨"이라 쓰는 것은 계획 §3.1이 명시적으로 금지한 추측이다).

대신 **판정 실패가 사용자에게 도달하지 않도록 코드에 강등 안전망을 넣었다**(§3.6 E4 · T4). 따라서 현재 코드는 두 결과 모두에서 안전하다:

- **호환 O** → 클러스터링이 동작한다(Path A 확정).
- **호환 X**(`addMarkers`가 `CustomOverlay`를 거부·throw) → 예외를 삼키고 **기존 개별 핀 경로로 자동 복귀**한다. 사용자 화면은 클러스터링 도입 이전과 동일하고 `ERROR` 배너도 뜨지 않는다. 이 경우 계획 §3.9 **Path B**로 전환하면 된다(재기획 불필요 — 계약이 이미 확정돼 있다).

계획 대비 **강화한 지점 1건**: 계획 E4는 "미로드/미정의/생성 실패"만 강등 대상으로 적었으나, `MarkerClusterer` 생성은 성공하고 **`addMarkers(CustomOverlay[])`에서 throw**하는 경우가 T0 리스크의 가장 현실적인 형태다. 그래서 `renderMarkers`의 `addMarkers` 호출도 try/catch로 감싸고, 실패 시 `clusterer.clear()` → `mkClusterer = null` → 전 오버레이 `setMap(mkMap)`으로 **런타임에 1회 강등**한 뒤 이후 렌더는 계속 개별 핀 경로를 쓴다. 즉 T0가 실패해도 "지도가 죽는" 경로가 없다.

**리더·QA 확인 요청**: 실기기 스모크에서 Metro 콘솔에 클러스터 관련 예외가 찍히는지(강등 발동 여부)를 S1과 함께 반드시 본다. 강등이 조용히 일어나면 화면상으로는 "클러스터링이 그냥 안 되는 것"처럼만 보인다.

---

## 2. 구현 요약 (`mapHtml.ts` 한 파일)

### 2.1 SDK 로드 (T1)
```
appkey=${KEY}&autoload=false           →  appkey=${KEY}&autoload=false&libraries=clusterer
```
`kakao.maps.load(cb)` 콜백 시점에 `MarkerClusterer`가 준비되고, 클러스터러 생성은 READY 이후 `__muklogInit`에서만 하므로 타이밍 안전. `libraries=services`는 여전히 미추가(Local 호출은 Edge Function 경유 — 비용 가드레일, spec에 `not.toContain('libraries=services')` 단언).

### 2.2 상수 블록 (T3, §3.7 — 스모크 튜닝 시 여기만 만진다)
`MK_CLUSTER_OPTIONS`(`averageCenter:true` · `minClusterSize:2` · `gridSize:60` · `minLevel:2` · `calculator:[10,100]`) + `mkClusterStyle(size, fontSize)` 팩토리 + `MK_CLUSTER_STYLES`(`40px/13px` · `48px/14px` · `56px/15px`). 공통 실값(배경 `#3366FF` · `#FFFFFF` · `2px solid #FFFFFF` · `borderRadius 999px` · `textAlign center` · `fontWeight 700` · `boxShadow 0 3px 5px rgba(0,0,0,0.18)`)은 팩토리 한 곳에 있다 — **§3.4 표 그대로, 창작 0**. 계획 주석대로 `zIndex`는 스타일에 넣지 않았다(오버레이별 컨테이너라 element z-index가 stacking에 무효).

`disableClickZoom`은 **설정하지 않았다**(기본 false) → 클러스터 탭 = Kakao 기본 줌인, 신규 inbound 메시지 0.

### 2.3 수명주기 (T2, §3.6 C2·C3)
- `ensureClusterer()`: `if (mkClusterer) return;`로 **1회만 생성**(재-INIT 시 재사용 — 재생성하면 이전 클러스터러의 버블이 유령으로 남는다, E8). 내부 전체가 try/catch이고 `kakao.maps.MarkerClusterer` 존재 검사를 선행한다. 실패 시 `mkClusterer = null`(강등)이며 **`ERROR`를 발신하지 않는다**.
  **재-INIT 재바인딩(R2, qa-logic L1)**: 재사용 판정 **이전에** `clear()` → `typeof setMap === 'function'`이면 `setMap(mkMap)`으로 새 Map에 재바인딩, 아니거나 던지면 `mkClusterer = null`로 폐기해 아래에서 재생성한다. `clear()`를 선행하므로 재생성 경로에서도 유령 버블이 남지 않는다(E8 유지).
- `__muklogInit`: `new kakao.maps.Map(...)` → **`ensureClusterer()`** → `renderMarkers(payload.markers)` 순서.
- `clearMarkers()`: `mkClusterer.clear()`(예외 격리) → 기존 `setMap(null)` 루프 → `mkOverlays=[]` · `mkPins={}`. **`clear()`가 던져도 `setMap(null)` 정리는 반드시 수행**되도록 try/catch를 씌웠다(고스트 핀 방지가 목적인 코드가 스스로 고스트를 만들면 안 된다).
- `renderMarkers()`: 오버레이 생성 시 `if (!mkClusterer) overlay.setMap(mkMap);`(클러스터러가 있으면 표시 소유권은 클러스터러 — 이중 표시 방지), 루프 후 `mkClusterer.addMarkers(mkOverlays)`.

### 2.4 마커 구현 불변 (제1 제약)
`div.mk-pin` CustomOverlay 경로는 **한 줄도 갈아끼우지 않았다**. §3.1의 6가지 계약(이모지 `textContent` · 3-way 색 클래스 · `.mk-pin--active` 토글 · `MARKER_TAP`+`stopPropagation` · `dataset.pinId`/`mkPins` 추적 · `overlay.setZIndex(pinZIndex(...))`)이 전부 그대로다. `me` 오버레이(`mkMeOverlay`)는 여전히 `mkOverlays`에 push되지 않아 `addMarkers` 인자에 포함되지 않는다(C4·T5).

---

## 3. 경계면 매핑 (생산자 ↔ 소비자) — qa-logic 교차검증용

| # | 생산자 | 소비자 | 확인 포인트 |
|---|---|---|---|
| 1 | `renderMarkers`(오버레이 생성·`addMarkers`) | `clearMarkers`(`clusterer.clear()` 선행) | `clear()` 누락 시 고스트 핀. `mapHtml.ts` `clearMarkers` 첫 줄이 `mkClusterer.clear()`인지 |
| 2 | `mkPins[id].el` 추적 | `__muklogSetSelected`의 `classList` 토글 | 클러스터에 흡수돼 DOM detach된 `el`도 참조가 살아 있어 토글이 예외 없이 수행됨(C5). `mkSelectedId` 유지 → `renderMarkers` 재적용 경로 불변 |
| 3 | `mapHtml` SDK URL(`libraries=clusterer`) | `MapPrewarm`(같은 `mapHtml()` 공유) | 프리워머가 클러스터러 스크립트까지 워밍. **프리워머는 INIT을 보내지 않으므로 `__muklogInit`도, `ensureClusterer()`도 실행되지 않는다** = 프리워밍 부작용 0(`MapPrewarm.tsx:7` 주석과 정합) |
| 4 | `MapTabScreen.markersKey` effect → `SET_MARKERS` | `renderMarkers` → `clear()` + `addMarkers` | 카테고리 필터·nearby 누적 변화가 재클러스터로 이어짐. `MapTabScreen` 변경 0 |
| 5 | `types.ts` `MapMarker`·`MapInboundType`·`MapOutboundType` | `mapHtml` | **전부 불변**(하나라도 바뀌면 Path A 전제 붕괴). `git status`로 확인 가능 |
| 6 | `mapHtml.spec.ts` 단언 | 실제 템플릿 | §4.2·§8 뮤테이션 검증 결과 참조 — 죽은 문자열 아님을 15종 뮤턴트(M1~M9 + Q1·Q2·Q5 + N1~N3)로 확인 |
| 7 | `pinZIndex` | 클러스터 버블 stacking | 클러스터 스타일에 `zIndex` 미포함(의도) → 클러스터↔개별 핀 stacking은 **스모크 S8 관찰 항목**, 코드 판단 불가 |
| 8 | `mergeMapMarkers` dedup(≈11m) | 클러스터 카운트 | 카운트는 `SET_MARKERS`로 넘어온 최종 배열(`mkOverlays`) 기준 → dedup으로 빠진 핀은 카운트에 없음. 두 레이어는 독립 |
| 9 | `muklogMiniMapHtml`(무관 모듈) | — | 이번 변경이 새지 않았는지 회귀 확인(파일 미변경) |

---

## 4. 테스트

### 4.1 단위 증분 (`mapHtml.spec.ts`, +13건 — 기존 29건 **삭제·완화 0**)
TDD 순서 준수: R1은 11건 작성 → Red(10 failed / 29 passed) 확인 → 구현 → Green. R2(qa-logic 반영)는 L1 회귀 단언 1건 + L2 강등 단언 1건을 먼저 추가해 **L1만 Red**임을 확인한 뒤(L2·L3·L4는 이미 옳은 코드를 잠그는 단언이라 green) 코드를 고쳤다. R3(재검증 반영)는 L5 단언 1줄만 보강했고 **코드 변경 0**이다(§8 참조).

`libraries=clusterer`+`appkey`+`autoload` 동시 유지 / `new kakao.maps.MarkerClusterer(` 1회 / **`__muklogInit`의 `ensureClusterer()` 호출부와 순서**(§4.2 참조) / 옵션 5종 실값 / 스타일 공통 실값 7종 + `zIndex` 부재 / S0·S1·S2 3단계(팩토리 호출 정확히 3회) / `addMarkers(mkOverlays)` + `mkOverlays.push(` 정확히 1회(me 제외 근거) / `clearMarkers` 안 `clusterer.clear()`+`setMap(null)` / 강등 분기(`MarkerClusterer` 존재 검사 · `catch` · 본문에 `ERROR` 없음 · **`type: 'ERROR'` 발신 지점 정확히 3곳 유지**) / 폴백 `setMap(mkMap)`+`!mkClusterer` 분기 / `if (mkClusterer) return;` 재사용.

위양성을 막으려고 **중괄호 매칭 `fnBody({fnName})` 헬퍼**로 함수 본문만 좁혀 단언했다(파일 전역 매칭이면 `.mk-pin`의 `#3366FF`가 클러스터 스타일 단언을 통과시킨다).

### 4.2 뮤테이션 검증 (계획 §5-1 규범 준수)
격리 사본을 **`src/` 밖 세션 스크래치패드**에 두고, 파일명을 jest `testMatch` 미매치(`check.mutcase.ts`)로 만들어 `--roots`+`--testMatch` 명시 실행으로만 돌린 뒤 **즉시 삭제**했다(원본 `src/` 미변경, 삭제 확인 완료).

| 뮤턴트 | 결과 |
|---|---|
| M1 `&libraries=clusterer` 제거 | ✅ killed |
| M2 `clusterer.clear()` 제거 | ✅ killed |
| M3 `minLevel: 2` → `1` | ✅ killed |
| M4 `if (mkClusterer) return;` 제거(재생성 허용) | ✅ killed |
| M5 `if (!mkClusterer)` 가드 제거(무조건 setMap) | ✅ killed |
| M6 boxShadow 값 변조 | ✅ killed |
| M7 `addMarkers(mkOverlays)` → `mkOverlays.concat(mkMeOverlay)` | ✅ killed |
| M8 `__muklogInit`의 `ensureClusterer();` 호출부 삭제 | ⚠️ **최초 survived** → 단언 1건 추가 후 ✅ killed |
| M9 `ensureClusterer()`↔`renderMarkers()` 순서 뒤바꿈 | ✅ killed |

**M8이 이 검증의 실질 수확이다.** `ensureClusterer` 정의만 단언했을 때는 호출부를 통째로 지워도 40건 전부 green이었다 — 클러스터링이 **조용히 죽는** 회귀를 단위 테스트가 못 잡는 상태였다. 호출부 존재 + `new kakao.maps.Map(` 이후 · `renderMarkers(payload.markers)` 이전이라는 **순서 단언**을 추가해 M8·M9 둘 다 killed로 만들었다.

### 4.3 전체 회귀 (T7)
`npm test` → **198 suites / 1991 tests 전량 green**. `npx tsc --noEmit` → **오류 0**. RN 변경이 0이라 지도 관련 기존 스위트(`MapTabScreen`·`parseMapMessage`·`mergeMapMarkers`·`MapPrewarm` 등)가 손대지 않은 채 통과한 것이 Path A 전제가 유지됐다는 증거다.

---

## 5. 디바이스 스모크 체크리스트 (T8 — **전량 미실행, 실기기 이월**)

이 기능의 **실질 검증자**다(단위 단언은 "계약 문자열이 사라지는 회귀"만 막는다). dev build + Metro/`adb logcat` 필수 — preview/production 빌드는 WebView 예외를 조용히 삼킨다(메모리 [native-module-debug-needs-devbuild]).

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| **T0** | **(최우선) 밀집 지역 진입 + 콘솔 관찰** | ① 클러스터 버블 생성 ② 묶인 개별 핀 사라짐 ③ 탭 시 확대·펼침, **콘솔 예외 0**. 하나라도 실패 → Path B(§3.9) 전환. ⚠️ **"콘솔 예외 0"과 "핀이 실제로 보이는가"를 따로 확인**한다(qa-logic U3) — 클러스터러가 throw 없이 조용히 no-op하면 강등이 안 걸리고 핀만 사라진다 | ⏳ 미실행 |
| S1 | 강남역 등 밀집 상권에서 nearby 15+ 상태 | 아이콘 겹침이 눈에 띄게 해소 | ⏳ 미실행 |
| S2 | 클러스터 버블 탭 | 확대되며 하위 핀 펼침(신규 시트·목록 없음) | ⏳ 미실행 |
| S3 | 최대 확대(레벨 1) | 클러스터 미생성, 개별 핀(이모지·3-way 색) | ⏳ 미실행 |
| S4 | 카테고리 필터 변경 → 원복 | 재클러스터, **고스트 핀·유령 버블 0** | ⏳ 미실행 |
| S5 | 개별 핀 탭(saved/nearby/wish 각 1회) | 카드 3종 그대로(`MARKER_TAP` 회귀 0) | ⏳ 미실행 |
| S6 | 핀 선택 → 줌아웃 흡수 → 줌인 | 크래시 0, 활성 강조 유지. 카드 도킹 유지는 **의도된 동작**(E5) | ⏳ 미실행 |
| S7 | clusterer 스크립트만 실패시킨 채 진입 | 지도·핀 정상(클러스터 없음), **에러 배너 미표시** | ⏳ 미실행 |
| S8 | 현재위치 FAB 탭 후 파란 점 | 파란 점이 클러스터에 흡수되지 않음 + 클러스터↔핀 stacking 관찰 | ⏳ 미실행 |
| S9 | 콜드스타트 → 지도 탭 진입 체감 | 도입 전 대비 체감 회귀 없음(MapPrewarm이 스크립트까지 워밍) | ⏳ 미실행 |
| **S10** | **(R2 신규, qa-logic L1) 지도 에러 배너 → "재시도" 탭**(= 같은 WebView에 INIT 재주입) | **핀이 다시 그려진다**(빈 지도 금지). 재바인딩 경로가 실제로 도는지 = `MarkerClusterer.setMap` 실존 확인을 겸한다 | ⏳ 미실행 |

**완료 기준(계획 §9-4)**: S1·S2·S3·S5·S7 통과 시 기능 완료. S6·S8·S9는 관찰·이월 허용.

---

## 6. 비용 가드레일 (계획 §8 대조)

| 항목 | 실제 |
|---|---|
| Kakao Local API 호출 | **0 증가** — `useNearbyPlaces`·`nearby-search` Edge Function·디바운스/양자화 캐시/최소이동 임계 전부 미변경(파일 diff 0). 클러스터링은 이미 받은 마커의 표시 레이어 |
| Kakao Map SDK 네트워크 | clusterer 라이브러리 스크립트 1회(HTTP 캐시). `MapPrewarm`이 같은 `mapHtml()`을 쓰므로 프리워밍에 자동 포함 |
| 클러스터 계산 | 100% WebView 로컬. 외부 호출·서버 왕복 0 |
| Supabase(RPC·쿼리·Realtime·Storage) | **0** |
| DB 마이그레이션 / RLS / Edge Function | **0건** (`supabase/` 미변경) |
| 폴링·타이머·리스너 | **0 추가** — 재클러스터는 Kakao가 기존 zoom/idle에 얹어 처리 |
| 신규 의존성 / AWS | **0 / 미사용** (`package.json` 미변경) |

---

## 7. 미완·이월

1. **T0 스파이크 + S1~S9 디바이스 스모크 전량**(§1·§5) — 실기기 필요. **이 스프린트의 유일한 실질 검증자이므로, 이것이 끝나기 전까지 기능은 "검증되지 않음"으로 간주한다**(메모리 [qa-layout-blind-spot]).
2. **클러스터↔개별 핀 stacking**(§3.4 주석 · S8) — 스타일에 `zIndex`를 넣지 않기로 계약된 상태라 관찰 후 문제가 보이면 후속. 없는 API를 지어내지 않았다.
3. **Path B 미착수** — T0 실패 시에만 발동. 계약은 계획 §3.9에 확정돼 있어 재기획 불필요.

## 8. qa-logic 1차 리포트 반영 (R2)

`docs/sprint/sprint-20260813-map-clustering/qa-report-logic.md` 지적 4건을 **전부 반영**했다.

### L1 [중대·신규 회귀] 재-INIT 시 핀 전멸 — 수정 완료
지적이 정확했다. 코드로 재확인한 발동 경로: `MapTabScreen.tsx:264-268` `handleRetry` → `sendInit()` → `webviewRef.current?.injectJavaScript(buildInitScript(...))`. **WebView 리마운트가 아니라 같은 인스턴스에 INIT을 재주입**하므로 JS 컨텍스트가 살아 있고 `mkClusterer`도 생존한다. 반면 `__muklogInit`은 `mkMap = new kakao.maps.Map(...)`으로 **새 Map 인스턴스**를 만든다. 여기서 `if (mkClusterer) return;`이 옛 Map에 묶인 클러스터러를 재사용하고, 내가 도입한 `if (!mkClusterer) overlay.setMap(mkMap);` 때문에 오버레이는 새 Map에 직접 붙지도 않는다 → **새 지도에 핀 0개, 예외 없음 = 강등도 `ERROR`도 안 걸리는 조용한 실패.** 도입 전에는 무조건 `overlay.setMap(mkMap)`이라 정상이었으므로 내 변경이 만든 회귀가 맞다.

수정(`ensureClusterer` 한 곳, 재사용 early-return **앞**):
```js
if (mkClusterer) {
  try {
    mkClusterer.clear();
    if (typeof mkClusterer.setMap === 'function') mkClusterer.setMap(mkMap);
    else mkClusterer = null; // setMap 미제공 SDK → 폐기 후 재생성
  } catch (e) { mkClusterer = null; }
}
if (mkClusterer) return;
```
QA가 요청한 "`MarkerClusterer.setMap` 실존을 T0에서 확인" 규율은 **`typeof` 가드로 코드 레벨에서도 지켰다** — 실존하면 재바인딩(계획 C3의 재사용 유지), 없으면 QA의 대안대로 `clear()` 후 재생성으로 자동 전환된다. 어느 쪽이든 핀은 그려지고, `clear()` 선행이라 E8 유령 버블도 없다. **어느 분기가 실제로 도는지는 S10 스모크에서 확인**한다(§5 표에 추가).

단언 1건 추가: `ensureClusterer` 본문을 `if (mkClusterer) return;` **앞 구간으로 잘라** `clear()`·`setMap(mkMap)`·`mkClusterer = null` 셋을 요구한다(순서까지 강제 — 뒤로 옮기는 뮤턴트 N3도 killed).

### L2 [필수] `addMarkers` 런타임 강등이 무방비 — 단언 추가
지적대로였다. `renderMarkers` 본문의 `setMap(mkMap)`·`!mkClusterer` 단언은 **생성 루프 가드**로 충족되므로 try/catch를 통째로 지워도 green이었다. `addMarkers` **이후 구간만 잘라** `catch`·`mkClusterer = null`·`setMap(mkMap)`를 요구하도록 추가했다(Q2 killed).

### L3 [필수] 죽은 단언(주석이 단언을 살림) — 좁힘 완료
`expect(clear).toContain('setMap(null)')`이 `:151` 주석 문장으로 통과하던 문제. `expect(clear).toContain('mkOverlays[i].setMap(null)')`로 좁혔다(Q5 killed). 주석이 단언을 통과시키는 패턴은 이 파일 전체의 위험 요소라, 앞으로 이 spec에 문자열 단언을 추가할 때는 **주석에도 등장할 수 있는 표현인지**를 먼저 본다.

### L4 [권장] 존재검사 단언이 생성자로 충족 — 좁힘 완료
`expect(ensure).toContain('if (!kakao.maps.MarkerClusterer) return;')`로 가드 문장 자체를 단언(Q1 killed).

### 재검증 뮤테이션 (격리 사본 — `src/` 밖 · `check.mutcase.ts`(testMatch 미매치) · 실행 후 즉시 삭제)
| 뮤턴트 | 이전 | 지금 |
|---|---|---|
| Q1 존재검사 가드 제거 | survived | ✅ killed |
| Q2 `addMarkers` try/catch 제거 | survived | ✅ killed |
| Q5 `clearMarkers` 오버레이 제거 루프만 삭제(주석 유지) | survived | ✅ killed |
| N1 L1 재바인딩 블록 삭제(회귀 재현) | — | ✅ killed |
| N2 `setMap(mkMap)` 재바인딩만 제거 | — | ✅ killed |
| N3 재바인딩을 early-return **뒤로** 이동 | — | ✅ killed |

### §3.12 권고 — `architecture.md` 재-INIT 성질 보강 (완료)
`map-clustering` 행에 다음을 명문화했다: **지도 에러 배너의 "재시도"는 WebView 리마운트가 아니라 같은 인스턴스에 INIT 재주입**이라 JS 컨텍스트(=클러스터러)는 살고 `mkMap`만 새 `kakao.maps.Map`으로 교체되며, 그래서 재사용 전 `clear()` + 새 Map 재바인딩이 필수이고 빠뜨리면 "새 지도에 핀 0개 + 예외 없음"의 조용한 실패가 된다는 것. 앞으로 이 WebView에 map 바인딩 객체를 추가하는 사람이 같은 함정을 밟지 않도록 설계 문서 레벨에 남긴다(`mkMeOverlay`는 재-INIT마다 새로 만들어 이미 안전한데 클러스터러만 빠졌던 것이 이번 회귀의 형태다). 상태 표기도 `1991 green` → `1993 green`으로 갱신.

### L5 [권장] 폐기 경로 둘이 서로를 가려주던 문제 — 반영 (R3)
재바인딩 구간에는 `mkClusterer = null`이 **두 경로**에 있다(`setMap` 미제공 SDK → `else` / `clear`·`setMap` 예외 → `catch`). L1 단언이 "있는지"만 봐서 한쪽을 지워도 다른 쪽이 단언을 충족시켰다(qa 뮤턴트 P2·P4 survived). 두 경로 다 옛 Map에 묶인 채 재사용되는 L1 회귀로 직결되므로 **개수로 잠갔다**:
```ts
expect(rebind.match(/mkClusterer = null/g)).toHaveLength(2);
```
자가 확인: P2(`else` 경로 제거)·P4(`catch` 경로 제거) **둘 다 killed로 전환**(격리 사본, 확인 후 삭제).

**교훈 갱신**: L3에서 "주석에도 등장할 수 있는 표현인지 먼저 본다"고 적었는데, L5는 그 한 단계 안쪽이다 — **같은 파일 안의 다른 코드 경로**도 같은 문자열을 제공한다. 문자열 단언을 쓸 때는 "이 문자열을 제공할 수 있는 곳이 여기 말고 또 있는가(주석·다른 분기·생성자)"를 묻고, 여러 곳이면 존재가 아니라 **개수나 위치**로 잠근다.

**P5(`typeof` 가드 제거)가 survived인 것은 qa 판정대로 equivalent mutant다** — `setMap` 부재 시 TypeError가 같은 `catch`로 잡혀 폐기·재생성으로 수렴하므로 관측 동작이 동일하다. 단언을 추가하지 않았다(동작 차이가 없는 것을 문자열로 굳히면 리팩터링만 막는다).

### D1 [경미] 체크섬 표 — **qa-logic이 오탐으로 철회** (기록만 남김)
qa가 R2 착수 배치에서 `architecture.md` 해시를 `0063a2a5…`(R1판)로 재고, 그 직후 내가 §3.12를 반영해 파일을 갱신한 뒤, 검증 후반 grep이 갱신본을 읽어 "표와 내용이 불일치"로 보였던 **측정 레이스**였다. R2 시점의 `0063a2a5…` "R1과 동일" 표기는 그 시점 기준으로 정확했고, §3.12 반영 시 `f96dfa6b…`로 재측정해 갱신했다(§0 표).

**다만 여기서 양쪽에 걸치는 교훈이 하나 나온다: 해시와 내용은 반드시 같은 배치에서 측정한다.** 서로 다른 시점의 두 관측을 한 시점으로 취급하면 없는 모순이 보인다. 검증자(qa)에게는 오탐의 원인이었고, 생산자(나)에게도 같은 함정이 있었다 — R3 통지에서 나는 문서 수정 시점의 spec 해시(`f5e88392…`)를 적었는데 그 뒤 L5를 반영해 실물은 `78a82d16…`이 돼 있었다. **파일 표는 정확했지만 통지 문구가 stale했다.** 앞으로 동결 통지는 "마지막 편집 이후 해시 재측정 → 그 배치에서 바로 통지"로 고정한다.

### R3 최종 동결 해시 (커밋 기준값)
| 파일 | SHA-256 |
|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | `cfe7e442d82652a383ae6659c9e267706093fd7199312ff14435af41ae0fb725` |
| `src/features/map/mapHtml/mapHtml.spec.ts` | `78a82d16b9b473d1cef2372960718563f040f523e413d0d547463064522a3961` |
| `docs/design/architecture.md` | `f96dfa6bbaafe489c3afdf0a4017c86a2cf82f5cb289aab85515bb2d10b1a743` |

R3 최종: `npm test` **1993 green**(198 suites) · `npx tsc --noEmit` **0** · 생성 스크립트 `node --check` 통과. RN 프로덕션 diff는 여전히 **0**(수정은 `mapHtml.ts` 안에서만 일어났다).

---

## 9. 소스 동결

R3 기준(§0 · §8 "R3 최종 동결 해시" 표)으로 **소스 최종 동결**한다. qa-logic 로직 검증 종료(합격·잔여 조치 0). 추가 변경하지 않는다. git 작업(커밋·푸시)은 사용자 전담 — 이 스프린트에서 git 명령을 실행하지 않았다.

**동결 표에 `dev-notes.md` 자신은 넣지 않는다(규범).** 파일이 자기 해시를 담는 순간 그 해시가 바뀌는 자기참조라 어떤 순서로 재측정해도 영구히 stale해진다 — 프로세스로 고칠 수 있는 항목이 아니다. 동결 대상은 **커밋 기준이 되는 소스·설계 문서 3종**이고, dev-notes는 그 표를 담는 그릇이다. (§8의 "해시·내용은 같은 배치에서 측정" 규범은 이 3종에 적용된다.)
