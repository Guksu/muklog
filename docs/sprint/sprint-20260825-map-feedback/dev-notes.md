# Dev Notes — sprint-20260825-map-feedback (U55 · U4 · U5)

> 구현 기준: `plan.md` §3 계약 · `docs/code-convention.md` · `docs/testing-strategy.md`(TDD Red→Green→Refactor)
> 최종 상태: **`npm test` 207 suites / 2239 tests 전량 green** · **`npx tsc --noEmit` 통과(exit 0)**
> (스프린트 본편 종료 시점은 2233 tests. qa-logic 후속 조치 6건이 더해진 현재 수치는 **§11** 참조 — §1~§10은 본편 기준 기술이고, §2 표 3행·§4는 §11에서 정정했다.)
> DB 마이그레이션 0 · RLS 0 · Edge Function 0 · 신규 npm 의존성 0 · 신규 브리지 메시지 0 · 킷 시안 변경 0

---

## 1. 변경 파일

| 파일 | 성격 | 무엇을 |
|------|------|--------|
| `src/features/map/mapHtml/mapHtml.ts` | 프로덕션 | U55 `disableClickZoom` + 줌인 상수 3종 + `mkClusterZoomIn` + `clusterclick` 등록 / U5 CSS 배경 2곳 |
| `src/features/map/useNearbyPlaces/useNearbyPlaces.ts` | 프로덕션 | U4 `researchAvailable` 식 교체 + 헤더·catch 주석 갱신 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 프로덕션 | U5 로딩 분기 조건에 `|| !mapReady` + 우선순위 주석 갱신 |
| `src/theme/tokens/tokens.ts` | 프로덕션 | U5 신규 토큰 `mapSurface: '#EFEAE3'` (palette + lightColor) |
| `src/features/map/components/MapWebView/MapWebView.tsx` | 프로덕션 | U5 컨테이너 배경 `theme.color.mapSurface`(`useTheme` 도입) + `testID="map-webview-container"` |
| `src/test/createMapSandbox/createMapSandbox.ts` | 테스트 인프라 | T0 — `level`/`getLevel`/`setLevel`/`setLevelCalls` · `fireClusterEvent` · `listenerCount` · `throwOnClusterListener` |
| `src/features/map/mapHtml/mapHtml.spec.ts` | 테스트 | U55 실행 6 + 문자열 3 · U5-1 1 · 기존 옵션 계약 테스트에 `disableClickZoom` 1줄 추가 |
| `src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts` | 테스트 | U4-1·U4-2·U4-3 신규 3 + spec:722 → A2 재작성 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | 테스트 | U5-2·U5-3·U5-3b 신규 3 + B1~B3 보정 |
| `src/theme/tokens/tokens.spec.ts` | 테스트 | U5-4 토큰 2 |
| `src/features/map/components/MapWebView/MapWebView.spec.tsx` | 테스트 | U5-5 컨테이너 배경 1 |

> **T0는 착수 시점에 이미 작업 트리에 들어와 있었다**(git 미커밋 변경분). 계약(§3.4)과 대조해 그대로 채택하고,
> 중복 선언 1건만 정리했다. `throwOnClusterListener`는 `addListener`의 `type === 'clusterclick'`에서만 던진다.
>
> **후속(§11)**: qa-logic 라우팅으로 위 파일 중 `MapTabScreen.tsx`·`MapTabScreen.spec.tsx`·`createMapSandbox.ts`·`mapHtml.spec.ts`가 추가 수정됐고, `mapHtml.ts`는 **주석만** 정정됐다.

---

## 2. 생산자 ↔ 소비자 매핑 (plan §7 qa-logic 경계면)

| # | 생산자 | 소비자 | 계약 |
|---|--------|--------|------|
| 1 | `mapHtml.ts` `ensureClusterer()` — 신규 생성 분기에서 `created`에 `clusterclick` 등록 후 `mkClusterer = created` | `mkClusterZoomIn(cluster)` | 핸들러는 **인자 `cluster` 하나만** 받고 `mkMap`은 모듈 변수를 매번 읽는다. `__muklogInit`이 `mkMap`을 새 `kakao.maps.Map`으로 교체해도 항상 현행 지도에 `setLevel`이 걸린다(U55-4가 `maps[0]` 0건 / `maps[1]` 1건으로 잠금) |
| 2 | `ensureClusterer()` 재사용(재-INIT) 분기 | `kakao.maps.event.addListener` | 재사용 분기는 등록하지 않는다 → `listenerCount({type:'clusterclick'}) === 1`(U55-3). 등록 지점이 하나뿐임을 `html.match(/'clusterclick'/g).length === 1`로도 잠금 |
| 3 | `demoteClusterer()` / `applyOverlayDelta` catch(기존 강등 경로) | 신규 `clusterclick` 리스너 | 강등되면 `mkClusterer=null`이고 `clear()`로 마커가 0이라 **버블이 그려지지 않는다 → 클릭 자체가 도달 불가**. 실 SDK는 `addListener(target,…)` 기준 **타깃별 디스패치**이므로 폐기된 클러스터러에 남은 고아 리스너는 미세 누수일 뿐 발화되지 않는다(U55 E2). **정정(qa-logic F3)**: 부작용 0의 근거는 `mkClusterZoomIn`의 `!mkMap`/`typeof getCenter` 가드가 **아니다** — 그 가드들은 이 경로에서 참이 되지 않는다(`mkMap`은 INIT 이후 null이 되지 않는다). 가드는 SDK 표면 변동(인자 없는 발화·비수 레벨) 방어용이며 U55 E3이 실행으로 잠근다 |
| 4 | `useNearbyPlaces.researchAvailable`(`useNearbyPlaces.ts:422-427`) | `MapTabScreen.tsx:427-438` 재검색 pill 렌더 → `nearby.research` | `currentBounds !== null`을 AND **밖**(공통 전제)에 유지 → `research()`의 `currentBoundsRef` 가드와 노출 조건이 일치한다. "눌러도 no-op인 버튼" 0(U4-3이 뮤테이션으로 잠금) |
| 5 | `useNearbyPlaces` 에러 경로(`catch` → `setStatus('error')`) | 비용 가드레일 | U4는 **사용자 탭 경로만** 연다. 자동(액션 없는) invoke 상한은 **불변 2회**(선로딩 1 + 보정 1) — 기존 C1~C9 전량 무수정 green |
| 6 | `MapTabScreen` `overlay` IIFE 우선순위 사슬 | `MapStatusOverlay` | `mapErrored` → 핀 `error` → **로딩(`state.status==='loading' \|\| !mapReady`)** → 권한 거부. `mapReady`는 `MapInboundType.Ready` 수신 시 `true`(`MapTabScreen.tsx:229-238`). SDK 실패는 `ERROR` → `mapErrored`가 맨 위에서 가로채므로 로딩이 영구 잔류하지 않는다(U5-3b) |
| 7 | `tokens.mapSurface` | `MapWebView` 컨테이너 · `mapHtml` CSS(`html,body`·`#map`) | 세 곳 실값 `#EFEAE3` 동일. 다크는 `darkColor`가 `lightColor`를 스프레드하므로 자동 미러(U5-4) |
| 8 | `createMapSandbox` 확장 표면 | `mapHtml.spec` U55 케이스 | 아래 §3 문서 근거 범위 안의 API만 모사(없는 API 0) |

---

## 3. SDK API 근거 재확인 (plan §3.1 표 대조 — 지어낸 API 0)

| 사용한 API | 근거 | 코드 위치 |
|-----------|------|----------|
| `MarkerClustererOptions.disableClickZoom: boolean` | Kakao 공식 샘플 `web/sample/addClustererClickEvent`("클러스터 마커를 클릭했을 때 지도가 확대되지 않도록") | `MK_CLUSTER_OPTIONS.disableClickZoom` → 생성자 전달 |
| `clusterclick` 이벤트 | 공식 문서 MarkerClusterer 이벤트 목록 + 같은 샘플의 `addListener(clusterer,'clusterclick',fn)` | `kakao.maps.event.addListener(created, 'clusterclick', mkClusterZoomIn)` |
| `Cluster.getCenter()` | 공식 문서 `Cluster` 클래스 메서드 | `mkClusterZoomIn`의 `cluster.getCenter()` (호출 전 `typeof === 'function'` 가드) |
| `Map.setLevel(level, { anchor, animate })` | 공식 문서 `Map.setLevel(level, options)` — `animate.duration` 기본 300ms, **레벨 차 2 이하에서만 애니메이션** | `mkMap.setLevel(next, { anchor, animate: { duration: 300 } })` |
| `Map.getLevel()` | 공식 문서 `Map.getLevel()` | `mkMap.getLevel()` (반환이 number가 아니면 조기 return) |

- `MK_CLUSTER_ZOOM_STEP = 1`이므로 레벨 차는 항상 1 → 문서상 애니메이션 조건을 만족한다. 상수를 2로 올려도 유효(2 초과는 금지).
- **`disableClickZoom`을 되돌리는 setter는 문서에 없다**(`setGridSize`·`setMinLevel` 등만 존재). 생성자에서 1회 확정이므로,
  리스너 등록 실패가 "클러스터는 보이는데 탭이 죽은" 상태를 만들 수 있다 → §4의 등록 순서 계약이 이를 구조적으로 막는다.

---

## 4. 등록 순서 계약 (§3.1 C) — 왜 대입 전인가

```js
var created = new kakao.maps.MarkerClusterer({ ..., disableClickZoom: ... });
kakao.maps.event.addListener(created, 'clusterclick', mkClusterZoomIn); // ← 대입 전
mkClusterer = created;
```

`addListener`가 던지면 `mkClusterer`는 `null`로 남아 기존 강등 경로(개별 핀 `setMap(mkMap)`)를 그대로 탄다.
`created`는 마커를 한 번도 받지 못하므로 버블을 그리지 않는다 → **탭이 죽은 클러스터가 존재할 수 없다.**
U55-6(`throwOnClusterListener`)이 `clusterer === null` · `clusterMode === 'none'` · 핀 3건 전량 `setMap(mkMap)` · `ERROR` post 0으로 잠갔다.

**정정(qa-logic F2).** 초판은 "대입을 먼저 했다면 탭이 죽은 클러스터가 실제로 만들어진다(회복 불가)"라고 적었으나 **사실이 아니다.**
`ensureClusterer`의 외부 `catch`가 `mkClusterer = null`로 되돌리므로 **대입 순서와 무관하게 강등된다** —
뮤턴트 N5(등록을 대입 뒤로 이동)에서 U55-6은 **green**이었고 순서 문자열 단언 1건만 red였다.
따라서 이 순서는 **그 `catch`가 사라질 미래 리팩터에 대한 이중 안전망(defense-in-depth)** 이고,
순서 계약을 실제로 잠그는 것은 spec의 문자열 단언 단독이다. 코드는 그대로 둔다(안전망을 없앨 이유가 없다).

---

## 5. `useNearbyPlaces.spec.ts:722` 충돌 경위와 재작성 (plan §3.2)

**충돌**: 기존 테스트 "조회 전에는 뷰포트를 받아도 researchAvailable=false(lastQueried 조건 하중)"가 만드는 상황
(= 첫 조회 실패 + 뷰포트 수신)이 곧 U4가 고치려는 버그였다. U4-1은 같은 상황에서 정반대(`true`)를 요구한다.
이 conjunct는 **qa-logic L2가 "다른 조건이 대신 false를 만들어 검증 대상이 놀고 있는" 죽은 단언을 막으려고 일부러 하중을 실어둔 것**이라
지우면 그 보호가 사라진다 → 삭제가 아니라 **같은 conjunct에 다른 방식으로 하중을 옮기는 재작성**을 했다.

**A2(재작성)**: 캐시 하이드레이션으로 `status==='ready'`가 되지만 `lastQueried`는 아직 `null`인 구간을 만들고,
하이드레이션 area와 **키가 다른** bbox로 `setBounds` → 캐시 히트 없이 0틱 조회만 예약된 상태에서 단언한다.
⚠️ **타이머를 흘리면 안 된다** — `fire()`가 돌아 `status='loading'`이 되면 다른 conjunct가 대신 `false`를 만들어 하중이 사라진다.
그래서 `settle()` 대신 타이머를 수동 제어한다(플랜 §5-1 A2 주의사항 그대로).

---

## 6. 뮤테이션 검증 결과 (plan §7 qa-logic 항목 7 + 자체 추가 2종)

전부 **원본 복원 후 재-green 확인 완료**. 각 뮤턴트는 스크래치패드 백업에서 되돌렸다.

| # | 뮤턴트 | 기대 | 결과 |
|---|--------|------|------|
| M1 | 생성자에서 `disableClickZoom: MK_CLUSTER_OPTIONS.disableClickZoom` 줄만 삭제(**`MK_CLUSTER_OPTIONS` 정의·주석은 유지**) | red | ✅ **U55-2만** red(1 failed / 170 passed). 문자열 단언(`options`에 `disableClickZoom: true`)은 **정의가 남아 있어 통과** — 정의 vs 호출부를 실행 단언이 갈랐다(메모리 "문자열 단언은 쉽게 죽는다"의 정확한 사례) |
| M2 | `#map` 규칙에서 `background: #EFEAE3` 한 곳만 삭제 | red | ✅ **U5-1** red(1 failed / 170 passed). `cssBlock('#map')` 단언 + 개수(3) 둘 다 걸린다 |
| M3 | `researchAvailable`에서 `lastQueried !== null &&` 절 제거 | red | ✅ 대량 red(35 failed / 70 passed) — **A2 포함**. null 참조로 훅 전체가 터진다 |
| M4 | `currentBounds !== null`을 AND 밖 → 드리프트 절 **안**으로 이동 | red | ✅ **U4-3만** red(1 failed / 53 passed). 공통 전제 위치가 실제로 잠겨 있다 |

---

## 7. 회귀 확인 (plan §5-1 "회귀 확인 필수" 목록 — 전부 무수정 green)

- `map-clustering` 계약: 클러스터러 1회 생성·재-INIT 재바인딩(AC11-b) · 3모드(AC7/AC8/AC9) · 런타임 강등(AC10) · 옵션·스타일 실값(`gridSize 60`·`minLevel 2`·`calculator [10,100]`·버블 40/48/56px) — **변경 0**
- `map-pin-loading` 계약: `T1-c`·`T1-d`(자동 조회 0) · `A3-5`(임계) · `A3-6`(성공 후 소멸) · `A3-7`(연타) · `A3-8`(research 실패 후 재탭) · "뷰포트 미수신이면 선로딩 성공해도 false" · "뷰포트 없으면 research() no-op" · 비용 가드레일 `C1`~`C9`(자동 invoke ≤2) — **변경 0**
- `MapTabScreen` 기존 스펙 중 **B1~B3 3건만** 보정(READY 발화 추가). 그 외 오버레이를 단언하지 않는 테스트(범례·마커탭·비JSON 무시 등)는 실행 결과로 무영향 확인.

### B1~B3 보정 상세

| # | 대상 | 왜 | 어떻게 |
|---|------|-----|--------|
| B1 | "권한 거부면 현재위치 안내를 노출하되…" | `!mapReady`가 로딩으로 가로채 **깨짐** | `renderWithTheme` 직후 `READY` 발화 추가(권한 안내는 로딩보다 아래 우선순위이므로 "부팅 이후" 상태를 본다) |
| B2 | "nearby 에러여도 slice1 오버레이…" | 동일하게 **깨짐** | 동일하게 `READY` 발화 추가 |
| B3 | "핀 loading이면 로딩 오버레이를 띄운다" | 깨지진 않지만 `!mapReady`가 **대신 충족**시켜 `state.status==='loading'` 단언이 죽는다 | `READY` 발화 **후에도** 로딩 배너가 뜨는지로 바꿔 핀 로딩 conjunct에 하중 유지 |

---

## 8. 비용 가드레일 (plan §8 체크 — 코드로 확인)

| 항목 | 결과 |
|------|------|
| Kakao Local(`nearby-search`) 호출 | **증가 0.** U55 확대는 WebView 로컬 계산이고, `setLevel`이 유발하는 `idle`→`BOUNDS_CHANGED`는 `setBounds` = "현재 뷰포트는 여기다" 통지일 뿐이다(허용분 소진 후 네트워크 0 — `C5`가 강제) |
| 자동(사용자 액션 없는) invoke 상한 | **불변 2회.** U4는 사용자 탭 경로만 연다 — 실패해도 자동 재시도 없음(`C1`~`C9` 무수정 green) |
| Kakao Map SDK 다운로드 | 불변(`libraries=clusterer`, URL 무변경 — 기존 문자열 단언이 잠금) |
| Supabase(DB·RPC·Storage·Realtime·Edge Function) | **0건** |
| 폴링·타이머·리스너 | 신규 타이머 0. 신규 리스너는 WebView 내부 `clusterclick` 1개(클러스터러당 1회, 재-INIT에서 증가하지 않음 — U55-3) |
| 신규 에셋·의존성·AWS | 0 / 0 / 미사용 |

---

## 9. 디바이스 스모크 이월 (실기기 — 단위로 볼 수 없다. 이 항목들이 단독 권위)

| # | 항목 | 합격 기준 | 상태 |
|---|------|----------|------|
| S1 | 클러스터 버블 탭 | **깜박임 없이** 클러스터 중심 방향으로 부드럽게 확대(사용자 리포트 재현 시나리오) | 이월 |
| S2 | 300ms 체감 | 느리게 끌리지도, 툭 끊기지도 않는다. 애니메이션이 실제로 걸리는가(레벨 차 1이라 문서상 가능) | 이월 |
| S3 | 탭 반복 | 2~3회 탭으로 클러스터가 풀린다. 답답하면 `MK_CLUSTER_ZOOM_STEP`을 **2로**(그때도 애니메이션 유지) | 이월 |
| S4 | 클러스터 탭 시 선택 카드 | 열려 있던 스팟 카드가 사라지는지 **관측만**(E12 — 이번 스프린트 수정 대상 아님) | 이월 |
| S5 | 지도 탭 진입 | 흰 여백이 보이지 않고 지도 톤 + 로딩 배너 → 지도로 전환 | 이월 |
| S6 | 배너 지속시간 | 배너가 300ms 미만으로 깜박이면 E5 후속 트리거(`useDeferredFlag({delayMs:250}) && !mapReady`) | 이월 |
| S7 | 오프라인 진입 → 온라인 복귀 | pill이 뜨고, 탭하면 주변 핀이 채워진다(U4 실사용 경로) | 이월 |
| S8 | 재-INIT(지도 에러 → 다시 시도) 후 클러스터 탭 | 정상 확대(E3 실환경 확인) | 이월 |
| **S9** | 기내모드로 지도 탭 진입 → 에러 배너 → **"다시 시도" 탭** | 영구 로딩 스피너에 **갇히지 않는다** — 에러 배너와 "다시 시도"가 그대로 남는다(§11 F1 수정의 실환경 확인). 갇히면 U10 타임아웃 본안 트리거 | 이월(신규) |

### 알려진 한계 (수정 대상 아님)

- **E6**: `READY`도 `ERROR`도 영영 오지 않는 조용한 실패면 로딩 배너가 영구 잔류한다. 타임아웃·실패 배너는 **U10** 대상.
  §11 F1 수정은 그중 **사용자가 "다시 시도"를 누른 뒤**의 dead-end만 막는다 — 진입 직후의 조용한 실패는 여전히 U10 소유다.
- **U10 범위**: U4 이후에도 주변 조회 실패는 여전히 무음이고 사용자가 보는 어포던스는 재검색 pill 하나다(플랜 §2 Out-of-scope 그대로).
- **E12**: 클러스터 탭이 지도 배경 click으로 새어 선택이 해제되는지는 단위로 관측 불가 → S4에서 기록만.

---

## 10. 계획 편차

없음. plan §3 계약(상수 실값·핸들러 시그니처·등록 위치/순서·`researchAvailable` 식·CSS 2곳·토큰 위치·적용 대상)을 그대로 구현했다.
플랜에 없던 **추가 결정 2건**은 아래뿐이며 둘 다 계약을 바꾸지 않는다.

1. `MapWebView` 컨테이너에 `testID="map-webview-container"` 부여 — U5-5가 컨테이너 스타일을 결정적으로 읽기 위한 것.
   (버튼에서 `.parent`로 거슬러 오르면 composite가 끼어 스타일을 못 읽는 기존 선례를 피한다 — `map-headerless` T3-6 주석 참조.)
   같은 편집에서 `MapWebView`가 화살표 표현식 본문 → 블록 본문 + `return`으로 바뀌었다(`useTheme` 호출 필요). JSX 들여쓰기만 함께 조정, 구조·배치 불변.
2. 문자열 계약 단언 3건 추가(줌인 상수 실값 / `mkClusterZoomIn` 무인자·모듈 변수 참조 / 등록 순서·개수).
   실행 단언이 이미 결과를 잠그지만, **그 결과를 만드는 구조**(옛 지도 참조 금지·대입 전 등록)를 직접 잠그기 위한 안전망이다.

### 작업 트리 관련 메모(리더 확인용)

- 구현 중 다른 세션이 `package.json`의 `testPathIgnorePatterns`에 `"/\\.claude/"`를 추가했다(에이전트 worktree 사본이 jest에 편입되던 문제).
  **내 변경이 아니다.** 반영 전 `npm test`는 414 suites / 4446 tests(worktree 사본 중복 포함), 반영 후 **207 suites / 2233 tests**가 실제 프로젝트 트리 기준 수치다.
- `docs/ux/ux-backlog.md`의 U4·U5·U55 상태(`진행(sprint-20260825-map-feedback)`)도 내 변경이 아니다.
  plan §9의 백로그 **완료** 전환·`architecture.md` 갱신은 리더 종료 판정 후 수행 대상이라 손대지 않았다.

---

## 11. qa-logic 후속 조치 (F1~F4 · F7)

`qa-report-logic.md` 판정은 **PASS(계약 위반 0)** 이고, §9 라우팅 표의 후속 개선 4건을 반영했다.
**계약 변경 0** — `researchAvailable` 식·U55 상수 실값·클러스터 옵션·오버레이 우선순위 순서·브리지 메시지·비용 상한(자동 invoke ≤2, 신규 타이머 0)은 그대로다.

| 항목 | 성격 | 파일 |
|------|------|------|
| F1 | 기능 수정(TDD) | `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` + `.spec.tsx` |
| F4 | 테스트 인프라 | `src/test/createMapSandbox/createMapSandbox.ts` |
| F3 | 테스트 보강 | `src/features/map/mapHtml/mapHtml.spec.ts` |
| F2·F3 | 문서·주석 정정 | `src/features/map/mapHtml/mapHtml.ts`(주석) · 본 문서 §2 표 3행 · §4 |
| F7 | nit | `src/test/createMapSandbox/createMapSandbox.ts` |

### F1 — 재시도 후 영구 로딩 dead-end

**증상.** `ERROR(SDK_LOAD_FAILED)` → 에러 배너 → "다시 시도" → `handleRetry`가 `setMapErrored(false)` + `sendInit()`.
SDK가 죽은 페이지에는 `__muklogInit`이 없어 **READY도 ERROR도 다시 오지 않는다** → `mapReady`가 false인 채 로딩 분기가 걸려
"지도를 불러오는 중이에요" 스피너가 영구 잔류하고 **재시도 버튼이 사라진다**. 바텀탭은 언마운트되지 않으므로 세션 내내 갇힌다.

**채택안 = qa-report §6 F1의 "최소 조치"(1번).**

```ts
const handleRetry = () => {
  if (mapReady) setMapErrored(false);   // ← READY를 한 번이라도 받은 경우에만 배너를 내린다
  void refresh();
  sendInit();
};
```

- 배너가 유지돼 **재시도 어포던스가 남는다.** 실제로 복구되면 `READY` 수신부가 `setMapErrored(false)`를 수행하므로 정상 경로는 불변.
- `sendInit()`은 조건 없이 그대로 호출한다 — SDK가 살아 있는 늦은 실패(READY 후 ERROR)는 즉시 복구된다.
- **경계**: U10(실패 배너·타임아웃 본안)은 범위 밖. **신규 타이머 0**을 유지했다(타임아웃 톤 전환은 U10 소유).
  진입 직후의 조용한 실패(§9 E6)는 여전히 U10 대상이며, 여기서 막은 것은 **버튼을 누른 뒤 도달하는 dead-end**뿐이다.

**추가 테스트 4건**(`MapTabScreen.spec.tsx`) — F1-1만 Red였고 나머지 3건은 회귀 방지용 잠금이다.

| # | 무엇을 |
|---|--------|
| F1-1 | READY 전 SDK 에러 → 재시도 → **에러 배너·`map-status-action` 유지 · 스피너 0**(Red→Green) |
| F1-2 | 재시도가 여전히 INIT을 1회 재주입한다(배너 유지가 복구 시도를 막지 않는다) |
| F1-3 | 재시도 후 실제 READY가 오면 오버레이가 사라진다(**정상 복구 회귀 방지**) |
| F1-4 | READY 후 늦게 온 ERROR는 재시도로 배너가 즉시 걷힌다(SDK 생존 경로) |

기존 오버레이 우선순위 사슬(`mapErrored` → 핀 `error` → 로딩+`!mapReady` → 권한)과 B1~B3 보정은 무수정 green.

### F4 — `createMapSandbox` 이벤트 디스패치에 타깃 필터 추가

실 Kakao SDK는 `addListener(target, …)` 기준 **타깃별 디스패치**인데 샌드박스는 `entry.type === type`만으로 걸러
**폐기·강등된 클러스터러의 고아 리스너까지 발화**했다(실환경에서 불가능한 사건).

```ts
fireClusterEvent: (payload: { target?: unknown; type: string; center?: Coords }) => void;
listenerCount:    (payload: { target?: unknown; type: string }) => number;
```

- `target` 미지정 시 기본값은 **현재 `mkClusterer`**(`clusterTarget({ target })`, `undefined`만 기본값으로 대체 — 명시적 `null`과 구분).
- `center`를 생략하면 Cluster 인자 **없이** 호출한다 → `mkClusterZoomIn`의 `cluster` 가드를 실행으로 태울 수 있다(F3용).
- **기존 호출부 변경 0** — `mapHtml.spec`의 `fireClusterEvent`/`listenerCount` 6곳 모두 현재 클러스터러가 타깃이라 그대로 통과했다.
- **F7**: `config` 기본값 객체에 `throwOnClusterListener: false`를 명시해 다른 플래그와 대칭을 맞췄다(동작 변화 없음).

### F3 — `mkClusterZoomIn` 가드 실행 커버리지

기존 `U55 E1`은 `available:false`·`constructThrows`라 **리스너가 애초에 등록되지 않아** "throw 0 · setLevel 0"이 vacuous하게 green이었다
(qa-logic 뮤턴트 N7에서 실행 스펙 0건 red). 실행으로 잠그는 케이스 2건을 추가했다.

| # | 무엇을 | 뮤턴트 red 확인 |
|---|--------|-----------------|
| U55 E2 | 런타임 강등(`throwOnAddMarkers`) 후 **기본 타깃**(=현재 `mkClusterer`=null) 발화 → `setLevel` 0 · `listenerCount({type}) === 0` · `listenerCount({target: orphan, type}) === 1`(고아 리스너 잔존을 명시) | `fireClusterEvent`의 타깃 필터 제거 → **E2 red** ✅ |
| U55 E3 | Cluster 인자 없이 발화 → throw 0 · `setLevel` 0 | `mkClusterZoomIn`의 가드 4개(`!mkMap`·`!cluster`·`typeof getCenter`·`typeof level`) 전량 제거 → **E3 red**(가드가 없으면 `cluster.getCenter()`에서 TypeError) ✅ |

두 뮤턴트 모두 확인 후 **원본 복원**했고(작업 트리 잔여 변경 0), 임시 파일은 스크래치패드에만 두었다(`src/` 내 0).

**남는 사실**: `!mkMap` 가드는 `mkMap`이 INIT 이후 null이 되지 않으므로 실행으로 red를 만들 수 없다 — 순수 방어(미래 리팩터 대비)로 남긴다.
`next === level` 하한 클램프는 U55-5가 이미 실행으로 잠그고 있다.

### 최종 상태

- `npm test` **207 suites / 2239 tests 전량 green**(2233 + 신규 6: F1-1~F1-4 · U55 E2 · U55 E3)
- `npx tsc --noEmit` **exit 0**

### F8 — 미사용 `fireMapEvent` 제거 (리더 직접 조치)

qa-logic 재검증(§10.9)이 찾은 nit. `createMapSandbox`의 `fireMapEvent`는 F4의 타깃 필터를 못 받아 `type`만으로 거르는데,
재-INIT 후엔 Map 인스턴스가 2개라 **옛 지도의 리스너까지 발화해 `BOUNDS_CHANGED`가 이중 emit될 수 있는** 함정이었다.
`grep -rn "fireMapEvent" src/` 결과 **호출처 0**(본편부터 미사용 표면)이라 타깃 필터를 얹는 대신 **표면에서 제거**했다
(컨벤션 "미사용 코드 없음" + 함정 제거). 타입 선언 1곳·구현 1곳, `src/test/createMapSandbox/createMapSandbox.ts` 한 파일.

제거 후 `npm test` **207 suites / 2239 tests green** · `npx tsc --noEmit` **exit 0**(테스트 수 불변 — 애초에 아무도 안 썼다).
훗날 지도 이벤트 발화가 필요해지면 `fireClusterEvent`와 같은 `target?` 필터 계약으로 되살린다.
