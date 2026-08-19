# dev-notes: map-nearby-load **S1 (A = 증분 마커 렌더)**

- **작성일**: 2026-08-18
- **구현**: developer
- **계획 단일 출처**: 같은 폴더 `plan.md` (§3 범위 · §4 계약 · §6 작업 목록 · §12 DoD)
- **범위**: **S1(A)만.** S2(D Edge 페이지 팬아웃)·S3(B 누적 캐시 영속)는 **미착수 — 코드 0줄**.

---

## 1. 한 줄 요약

`mapHtml.ts`의 `renderMarkers`가 매 배치마다 전 오버레이를 파괴·재생성하던 것을 **delta(add/remove/keep) 조정**으로 바꿨다. 유지되는 핀은 DOM 요소·CustomOverlay·탭 리스너까지 **같은 객체 그대로** 산다. RN 코드는 한 줄도 바뀌지 않았다.

---

## 2. 변경/신규 파일

| 파일 | 상태 | 내용 |
|---|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | 수정 | WebView 템플릿 JS: 증분 조정 + 클러스터 3모드 + 재-INIT 리셋 |
| `src/features/map/mapHtml/mapHtml.spec.ts` | 수정 | 42 → **80건**(문자열 계약 47 + 실행 33). 상세는 §6 |
| `src/test/createMapSandbox/createMapSandbox.ts` | **신규** | WebView 스크립트 실행 샌드박스(테스트 전용) |
| `src/test/createMapSandbox/index.ts` | **신규** | 배럴 |

> **경로 정정**: plan T1이 지정한 `src/test/mapHtmlSandbox/mapHtmlSandbox.ts` 대신 `src/test/createMapSandbox/createMapSandbox.ts`를 썼다. `docs/code-convention.md:153`("파일명은 대표 export 심볼명과 일치")과 같은 디렉터리 선례(`renderWithTheme/renderWithTheme.tsx`)를 따른 것이다 — 이 파일의 대표 export는 `createMapSandbox`이고 나머지는 전부 type이다. 컨벤션이 CLAUDE.md의 단일 출처이므로 plan의 경로 문구보다 우선했다(qa-logic N1).

**diff 0 확인(§12 DoD)**: `MapTabScreen` · `useNearbyPlaces` · `mapMessages` · `searchNearby` · `components/` 전부 `git diff --stat` 빈 결과. DB 마이그레이션 · Edge Function · RLS **0건**.

---

## 3. WebView 내부 계약 (실제 구현값)

### 3.1 상태

```js
var mkPins = {};              // id -> { el, overlay, kind, sig }   ★ sig 추가
var mkSelectedId = null;      // 무변경
var mkClusterer = null;       // 무변경
var mkClusterMode = 'none';   // ★ 신설: 'none' | 'partial' | 'full'
// mkOverlays 폐기 — 표시 중 오버레이는 allPinOverlays()로 mkPins에서 파생한다.
```

`pinSig(m) = m.kind + '|' + m.emoji + '|' + m.lat + '|' + m.lng`
→ **id 없음**(키=동일성, sig=내용), **selected 없음**(선택은 `SET_SELECTED`가 클래스 토글로 단독 처리 — map-pin-select 결정 유지).

### 3.2 신규/변경 함수

| 심볼 | 상태 | 책임 |
|---|---|---|
| `pinSig(m)` | 신규 | 재사용 가능 여부의 단일 판별자 |
| `createPinOverlay(m)` | 신규 | el + overlay 생성 + `mkPins` 등록. **지도 표시는 안 한다**(소유권은 `applyOverlayDelta`) |
| `allPinOverlays()` | 신규 | `mkPins`에서 오버레이 전량 파생(full 재구성·강등 복구용) |
| `demoteClusterer()` | 신규 | 강등(E4) — clear → `mkClusterer=null` → `mkClusterMode='none'` → **레지스트리 전량** `setMap(mkMap)` |
| `forgetPinByOverlay(overlay)` | 신규 | 부착 실패 롤백 전용(§8 L1). 실패 경로에서만 도는 O(n) 스캔 |
| `applyOverlayDelta(added, removed)` | 신규 | 모드별 표시 반영. 변화 0이면 즉시 return(E1) |
| `syncClusterMode()` | 신규 | 모드 1회 확정. `typeof removeMarkers === 'function'` → partial, 아니면 full |
| `resetMarkers()` | 신규 | 재-INIT 전용 전량 폐기(핀별 try/catch) — `clearMarkers()` 대체 |
| `renderMarkers(markers)` | 내부 전면 교체 | 시그니처 유지. 선행 전량 삭제 없음 |
| `clearMarkers()` · `mkOverlays` | **삭제** | 잔재 0(문자열 단언으로 잠금) |
| `pinZIndex` · `__muklogSetSelected` · `__muklogRecenter` · `emitBounds` | 무변경 | — |

### 3.3 `__muklogInit` 실행 순서 (계약 고정)

```
new kakao.maps.Map(...) → me 오버레이 → resetMarkers() → ensureClusterer() → renderMarkers(payload.markers)
```

`resetMarkers()`가 `ensureClusterer()`보다 **앞**. 순서 자체를 `mapHtml.spec.ts`가 인덱스 비교로 잠갔다.

### 3.4 ⚠️ 계획 대비 1건 보강 — `ensureClusterer`의 `finally`

plan §4.4는 "모드는 `ensureClusterer()` 말미에 1회 확정"이라고만 썼는데, 그대로 함수 끝에 한 줄 두면 **라이브러리 미로드 경로(`if (!kakao.maps.MarkerClusterer) return;`)가 확정을 건너뛴다**. `syncClusterMode()`를 `try/catch`의 `finally`에 넣어 조기 return도 반드시 통과하게 했고, 재사용 early-return 앞에도 1회 둔다(총 호출 지점 2, 실행은 경로당 1회 확정). 테스트가 `syncClusterMode();` 등장 횟수 2를 잠근다.

---

## 4. 클러스터러 정합 (직전 스프린트 map-clustering과의 경계)

| 모드 | 진입 조건 | 추가 | 제거 |
|---|---|---|---|
| `none` | `mkClusterer === null`(미로드·생성 실패·강등 후) | `overlay.setMap(mkMap)` | `overlay.setMap(null)` |
| `partial` | 클러스터러 존재 **and** `typeof removeMarkers === 'function'` | `addMarkers(added, nodraw)` | `removeMarkers(removed, nodraw)` → 끝에 `redraw()` 1회 |
| `full` | 클러스터러 존재 **but** `removeMarkers` 부재 | `clear()` → `addMarkers(allPinOverlays())` | 동일 |

- `nodraw`(2번째 인자)는 **`typeof mkClusterer.redraw === 'function'`일 때만** 넘긴다. redraw가 없으면 `nodraw` 없이 호출해 각 호출이 스스로 그리게 둔다 — 직전 스프린트 규율 "없는 API를 지어내지 않는다" 계승.
- 클러스터 모드에서 `overlay.setMap`을 직접 부르는 코드는 **`demoteClusterer()` 내부에만** 있다(B3 소유권 규칙).
- 강등은 **단방향**(clustered → none). 부활 경로는 재-INIT뿐이고 그때는 §3.3 순서로 전량 재구성된다.
- 강등 시 **delta가 아니라 레지스트리 전량**을 부착한다. delta만 붙이면 클러스터러가 그리던 유지 핀이 어디에도 안 붙어 핀이 통째로 사라진다(뮤턴트 M5로 잠금).
- `ERROR` 발신 지점은 기존 3곳(SDK_UNAVAILABLE · SDK_LOAD_FAILED · INIT catch) 그대로. 강등은 **ERROR 미발신**.

### T0 스파이크 결과 ⚠️ **부분 미완 — 리더/QA 확인 필요**

| 확인 방법 | 결과 |
|---|---|
| Kakao 공식 문서(`apis.map.kakao.com/web/documentation/#MarkerClusterer`) 조회 | `addMarker` · `removeMarker` · `addMarkers` · `removeMarkers` · `clear` · `redraw` **전부 문서상 존재**. `nodraw` 파라미터 유무는 문서 목차 수준에서 확인 불가 |
| 디바이스/시뮬레이터 콘솔 `typeof` 실측 | **미수행** — 이 세션은 실기기·시뮬레이터 실행 수단이 없고, clusterer 번들 직접 fetch도 실패(SDK 로더가 유효 appkey 요구, CDN 직접 경로 404) |

**위험 평가: 낮음.** 세 메서드 전부 `typeof` 가드 뒤에 있어 부재 시 자동으로 `full`/nodraw-없음 경로로 떨어지고, **그 폴백 경로들이 전부 테스트로 커버돼 있다**(AC7-b·AC8). `nodraw`에 여분 인자를 넘기는 것도 실 SDK가 무시하면 무해하다. 다만 **디바이스 스모크 S8(full 경로 재수행)이 "필요 없다"고 단정할 근거는 아직 없다** — §7의 S1~S3에서 실제로 어느 모드로 확정되는지(`mkClusterMode` 값) 콘솔로 1회 찍어 dev-notes에 실측값을 채워야 T0가 닫힌다.

---

## 5. 경계면 매핑 (생산자 ↔ 소비자) — qa-logic 교차검증용

| # | 생산자 | 소비자 | 확인 포인트 |
|---|---|---|---|
| B1 | `MapTabScreen.reinjectMarkersOnChange` → `buildSetMarkersScript` | `window.__muklogSetMarkers` → `renderMarkers` | **RN diff 0**. `SET_MARKERS`는 여전히 "표시되어야 할 **전체 집합**" 선언(부분 패치 변질 0) |
| B2 | `renderMarkers` | `mkPins` 레지스트리 | I1(유지 핀 재생성 0) · I2(키 집합 == 주입 id 집합) · I3(표시 == 레지스트리) · I4(선택 핀 active) |
| B3 | `applyOverlayDelta` / `demoteClusterer` | `mkClusterer`(map-clustering 산출물) | 클러스터 모드에서 `overlay.setMap` 직접 호출은 강등 내부에만 |
| B4 | `__muklogInit` | `resetMarkers` → `ensureClusterer` → `renderMarkers` | 순서가 코드에 그대로. 바뀌면 재시도 후 빈 지도 |
| B5 | `__muklogSetSelected` | `pinSig` | sig에 selected **없음** → 선택 시 재생성 0 |
| B6 | — | `mapHtml.spec.ts` | 아래 §6 참조 ⚠️ |
| B7 | `src/test/createMapSandbox` | jest / 앱 번들 | 앱 코드 import **0**, testMatch 미매치(스위트 수 199 → 199 불변), `tsc` 통과 |
| B8 | `docs/code-convention.md` | 샌드박스·스펙 | 화살표 const·named-object 인자 준수. HTML 템플릿 내부 JS는 기존 예외(ES5 `var`/`function`) 유지 |
| B9 | 비용 | `searchNearby` · `useNearbyPlaces` | diff 0 — Kakao·Supabase 호출 경로 미접촉 |

---

## 6. ⚠️ plan §7/B6 "기존 42건 삭제 라인 0"을 **완전히는 지키지 못했다** (리더 확인 요청)

plan은 두 가지를 동시에 요구하는데 서로 모순이다:

- §4.6 — `clearMarkers()`와 `mkOverlays`를 **삭제**한다.
- §7/B6 — `mapHtml.spec.ts` 기존 42건은 **삭제·완화 0**(diff 삭제 라인 0).

기존 42건 중 **2건이 그 삭제 심볼에 문자열로 직접 묶여 있어** 문장 그대로는 존속이 불가능했다(`mkClusterer.addMarkers(mkOverlays)` / `mkOverlays.push(` 개수 1 / `fnBody('clearMarkers')`). **의도를 후속 심볼 위에서 더 강하게 다시 잠그는 방식으로 재작성**했고, 나머지 2건은 대상 함수만 옮겼다.

| 원래 it | 처리 | 재작성 후 무엇을 잠그나 |
|---|---|---|
| `renderMarkers가 클러스터러에 mkOverlays를 넘긴다(me 제외 §3.6 C4)` | 재작성 | 클러스터러가 받는 오버레이는 delta 또는 `allPinOverlays()` 뿐 + **레지스트리 등록 지점이 `createPinOverlay` 한 곳뿐**(정규식 개수 1) + `applyOverlayDelta`에 `mkMeOverlay` 부재 |
| `clearMarkers가 클러스터러를 먼저 비운다(고스트 방지 §3.6 C2)` | 재작성 | `resetMarkers`가 `mkPins[id].overlay.setMap(null)` + 핀별 catch + `mkPins = {}` **그리고** `resetMarkers();`가 `ensureClusterer();`보다 앞 + `clearMarkers` 잔재 0 |
| `클러스터러가 없으면 개별 핀 경로로 렌더한다` | 대상 함수 이동 | `applyOverlayDelta`의 `mkClusterMode === 'none'` 분기 + `setMap(mkMap)`/`setMap(null)` |
| `addMarkers가 던지면 폐기하고 개별 핀으로 되돌린다` | 대상 함수 이동 + 강화 | `demoteClusterer()` 호출 + `allPinOverlays()`(delta 아님) + `mkClusterMode = 'none'` |

나머지 **38건은 문자열 그대로 무수정**이다. 완화된 단언은 **0건**(모두 같거나 더 강해졌다). 이 4건을 그대로 두는 유일한 방법은 삭제된 심볼 이름을 코드에 되살려 단언만 통과시키는 것이라 — 죽은 단언을 만드는 셈이라 택하지 않았다. **plan §7·B6 문구 갱신이 필요하다.**

### 테스트 증분

| 구분 | 건수 |
|---|---|
| 기존(문자열, 무수정) | 38 |
| 기존(문자열, 의도 보존 재작성) | 4 |
| 신규 문자열 계약(T7) | 5 |
| 신규 실행 단언(T1·T3~T6, 샌드박스) | 30 |
| qa-logic 하드닝(L1·L1-b·L2) | 3 |
| **`mapHtml.spec.ts` 합계** | **80** |

프로젝트 전체: **199 suites / 2038 tests** (직전 2000 → +38). 스위트 수 불변 = 샌드박스가 testMatch에 안 잡힌다는 증거.

AC 커버리지: AC1·AC2·AC3·AC4(+AC4-b 좌표 변형)·AC5·AC6·AC7(+AC7-b redraw 부재)·AC8·AC9·AC10·AC11(+AC11-b partial)·AC12·AC13·AC14·AC15·AC16 **전부 구현**. 부수로 E1·E2·E3·E5·E9·E11 · 핀 계약 6종 회귀 · me 오버레이 제외(C4)도 실행으로 잠갔다.

---

## 6-1. qa-logic 하드닝 반영 (2차, QA 통과 후)

qa-logic이 **블로커 0으로 통과**시키며 선택 사항으로 남긴 3건을 전부 이번 슬라이스에서 반영했다(다음 스프린트 이월 대신). 계약·RN·비용 영향 0.

| # | 지적 | 반영 |
|---|---|---|
| **L1** | `applyOverlayDelta`의 `none` 분기만 예외 격리가 없다. 예외가 `__muklogSetMarkers` 밖으로 새는데 RN 주입부에 try/catch가 없어 조용히 실패한다 | 핀별 `try/catch`로 격리(제거·추가 양쪽). **QA 패치보다 한 걸음 더 나갔다** — 격리만 하면 QA가 지목한 진짜 문제(자기치유 실패)가 그대로 남는다. 부착에 실패한 핀은 `forgetPinByOverlay`로 레지스트리에서 되돌려, 다음 주입이 새로 만들어 붙이게 했다. 이걸로 §4.1의 "전체 집합 재주입 1회로 자기치유"가 **모든 분기에서** 성립한다 |
| **L2** | 강등 경로에서 `removed` 탈착이 SDK 호출 성공에만 의존한다. `removed`는 이미 `mkPins`에서 빠진 뒤라 못 떼면 회수 수단이 없는 영구 유령이 된다 | `catch`에서 `demoteClusterer()` 앞에 `removed`를 핀별 `setMap(null)`로 직접 탈착 |
| **N1** | 샌드박스 파일명이 컨벤션(파일명=대표 export 심볼명)과 불일치 | `mapHtmlSandbox/mapHtmlSandbox.ts` → **`createMapSandbox/createMapSandbox.ts`** 개명(선례 `renderWithTheme/renderWithTheme.tsx`와 동형). import 2곳 갱신. plan T1 경로 문구와의 차이는 §2 각주에 기록 |

L1·L2 모두 **TDD로 처리**했다(Red 3건 확인 → 구현 → Green). 도달 가능성은 QA 평가대로 낮지만, 두 경로 다 "조용히 틀린 상태로 고착"되는 실패 양식이라 값이 싸면 막는 쪽이 낫다고 판단했다.

---

## 7. 뮤테이션 점검 결과 (T8) — **M1~M9 전부 killed**

실행 방식: `mutation-tmp/`(프로젝트 루트, **`src/` 밖**)에 mapHtml·샌드박스·스펙 사본을 만들고 스펙 파일명을 `check.mutspec.ts`로 둬 **jest testMatch(`*.spec.ts`)에 미매치**시킨 뒤 `--testMatch` 명시로만 실행. 전 뮤턴트 종료 후 디렉터리 **삭제 완료**(`ls` 확인, `git status` 잔재 0).

| # | 뮤턴트 | killed | 죽인 테스트(발췌) |
|---|---|---|---|
| BASELINE | 뮤턴트 없음(사본 sanity) | — | 80/80 green |
| **M1** | `__muklogInit`에서 `resetMarkers()` 제거 | ✅ 4 fail | AC11 · AC12 · AC13 · `resetMarkers ... 순서` |
| **M2** | `pinSig`에서 lat/lng 제외 | ✅ 2 fail | **AC4-b(좌표만 변경)** · pinSig 문자열 계약 |
| **M3** | 유지 판정 무시하고 항상 재생성(옛 동작) | ✅ 13 fail | AC1 · AC2 · AC3 · AC4 · AC7 · AC8 · E11 등 |
| **M4** | `removed` 오버레이 detach 안 함 | ✅ 7 fail | AC3 · AC5 · AC7 · AC9 · AC16 |
| **M5** | 강등 시 delta만 재부착 | ✅ 2 fail | **AC10(유지 핀 setMap 길이 1)** · 강등 문자열 계약 |
| **M6** | 모드 판정에서 `typeof` 가드 제거(항상 partial) | ✅ 2 fail | **AC8(full 경로)** · 모드 확정 문자열 계약 |
| **M7** | none 분기 부착 실패 시 레지스트리 롤백 제거 | ✅ 1 fail | **L1-b(자기치유)** |
| **M8** | 강등 전 `removed` 직접 탈착 제거 | ✅ 1 fail | **L2(영구 유령)** |
| **M9** | none 분기 `removed` 탈착의 예외 격리 제거 | ✅ 1 fail | **L1(예외 전파)** |

M7~M9는 §6-1 하드닝 3건 각각이 테스트로 잠겨 있는지 확인하려고 QA 지적 후 추가한 것이다(계획 표에는 없던 뮤턴트). 셋 다 **정확히 대응 테스트 1건씩만** 죽인다 — 단언이 그 결함을 정조준한다는 뜻이다.

qa-logic이 독립으로 만든 4종(순서 뒤집기·E1 early-return 제거·생성 시 active 재적용 제거·full 모드 delta만 등록)도 전부 killed로 보고받았다.

---

## 8. 디바이스 스모크 (§7) — **미수행. 사용자/QA 실행 필요**

이 세션에는 실기기·시뮬레이터 실행 수단이 없다. 아래는 **실행 대상 체크리스트이며 결과는 비어 있다**(임의로 pass 표기하지 않는다). 특히 **S2·S5·S6가 이번 슬라이스의 핵심**이다.

| # | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| S1 | 지도 탭 진입 → 첫 핀 표시 | 기존과 동일하게 핀·클러스터 버블(회귀 0) | ☐ |
| **S2** | 지도를 짧게 여러 번 팬 | **이미 떠 있던 핀이 깜빡이지 않는다.** 신규 핀만 추가 등장 | ☐ |
| S3 | 줌 인/아웃 반복 | 버블 개수·위치 자연스럽게 갱신, 유령 버블·이중 핀 0 | ☐ |
| S4 | 카테고리 칩 전환(전체→한식→전체) | 남는 핀 유지, 빠진 핀만 사라짐. 되돌리면 복구 | ☐ |
| **S5** | 핀 선택 후 지도 이동(신규 핀 유입) | 선택 핀의 확대·그림자가 **끊기지 않는다** | ☐ |
| **S6** | 기내모드로 SDK 에러 → 온라인 복귀 → "다시 시도" | 재-INIT 후 핀 **정상 표시**(빈 지도 0) | ☐ |
| S7 | 앱 백그라운드 → 복귀 | 핀 유지, 중복 0 | ☐ |
| S8 | T0가 `full`로 밝혀지면 그 경로로 S2~S4 재수행 | 깜빡임은 버블 수준까지만, 핀 DOM은 유지 | ☐ |

**S1~S3 수행 시 같이 찍어줄 것**: WebView 콘솔에서 `mkClusterMode` 값과 `typeof clusterer.removeMarkers` / `typeof clusterer.redraw` → **T0 실측값**을 여기에 채우면 T0가 닫힌다(§4).

---

## 9. 비용 가드레일

| 항목 | 영향 |
|---|---|
| Kakao Local API 호출 | **0 증가**(`searchNearby` diff 0) |
| Kakao Map JS SDK 로드 | 0 증가 |
| Supabase Edge invoke / DB / Storage / Realtime | **0**(마이그레이션·쿼리·함수 0) |
| AWS | 0 |
| 디바이스 자원 | **감소** — 배치당 DOM 생성/파괴 N개 → delta개. 100건 유지 + 1건 유입 시 `createElement` 101회 → **1회**(테스트로 잠금) |
| 번들 크기 | HTML 문자열 ~90줄 증가(무시 가능). 샌드박스는 테스트 전용이라 번들 도달 0 |

---

## 10. 미완/후속

- **T0 실측값**(§4) — 디바이스 스모크와 함께 채운다.
- **디바이스 스모크 S1~S8**(§8) — 전부 미수행.
- **plan §7·B6 문구 정정**(§6) — "기존 42건 삭제 라인 0"은 §4.6과 양립 불가.
- **plan T1 경로 문구 정정**(§2 각주) — 샌드박스 파일명이 컨벤션에 맞게 `createMapSandbox`로 개명됐다.
- S2(D Edge 페이지 팬아웃) · S3(B 누적 캐시 영속) — **미착수**(별도 plan.md 대상).
- **알려진 한계(수용, plan F1)**: `markersKey`가 `id:kind`만 담아 emoji/좌표만 바뀐 갱신은 `SET_MARKERS`를 발화시키지 않는다. **오늘과 동일한 동작이라 회귀 아님**. sig의 emoji/lat/lng 분기는 다른 핀 변경으로 발화한 주입에서 함께 반영된다.
