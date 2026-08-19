# qa-report-logic: map-nearby-load **S1 (A = 증분 마커 렌더)**

- **검증일**: 2026-08-19
- **검증**: qa-logic (integration-qa 스킬)
- **대상 커밋 기준**: `6fefee6` 위 워킹트리 (dev 소스 동결 상태)
- **범위**: 로직·통합 정합성·보안/비용·TDD·컨벤션. **비주얼 충실도는 qa-visual 담당(미투입 — §8에서 판정 타당성 확인)**

## 판정: **로직 PASS (조건부)** — 2026-08-19 **하드닝 반영 후 재검증 완료**(§14)

블로커 0. 릴리스를 막는 결함은 없다. 다만 **디바이스 스모크 S1~S8과 T0 실측이 전부 미수행**이라 스프린트를 "완료"로 닫을 수는 없다(§7). 코드 개선 권고 2건(L1·L2)은 모두 **이중 실패 경로의 하드닝**이며 이번 슬라이스 차단 사유가 아니다.

### 검증 착수/종료 체크섬 (소스 무변경 증명)

| 파일 | SHA-256 (착수 == 종료) |
|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | `18f56006…8a21a5` |
| `src/features/map/mapHtml/mapHtml.spec.ts` | `3f0241cd…a8674fc5` |
| `src/test/mapHtmlSandbox/mapHtmlSandbox.ts` | `7fd56023…5edabb12dba` |
| `src/test/mapHtmlSandbox/index.ts` | `46ad2fb3…9fa22c5364` |

QA는 소스를 한 줄도 만지지 않았다. 뮤테이션은 전부 스크래치패드 격리 사본에서 수행하고 삭제했다(§6). `git status` 잔재 0, **`src/` 안 임시 파일 0**.

---

## 1. 게이트 실행 결과 (QA 직접 실행)

| 게이트 | 결과 |
|---|---|
| `npm test` | **199 suites / 2035 tests 전량 green** (6.1s) |
| `npm run typecheck` (`tsc --noEmit`) | **exit 0, 오류 0** |
| 스위트 수 | 199 → 199 **불변** = 샌드박스가 jest testMatch에 안 잡힌다 |
| `mapHtml.spec.ts` it 개수 | 42 → **77** (`git show HEAD:` 대조) |

---

## 2. 최우선 검증: 클러스터러 소유권 ↔ 증분 렌더 상호작용 (리더 지시 #1)

직전 스프린트(map-clustering)의 소유권 규칙과 delta add/remove가 lockstep인지, **유령 핀**·**빈 지도** 경로가 있는지 코드 흐름으로 추적하고 샌드박스로 실행 확인했다.

### 2.1 소유권 규칙 (B3) — **PASS**

`mapHtml.ts:251-279 applyOverlayDelta`가 표시 반영의 **유일한** 지점이고, 클러스터 모드에서 `overlay.setMap`을 직접 부르는 코드는 `demoteClusterer()`(L239-247) 내부에만 있다. QA 탐침 P7(partial 모드에서 add·remove 배치를 3회 돌린 뒤 전 오버레이의 `setMapCalls` 길이 0)로 실행 확인했다.

### 2.2 add/remove ↔ 멤버십 lockstep — **PASS**

`renderMarkers`(L296-320)는 2단계에서 `mkPins`에서 삭제하며 `removed`에 담고, 3단계에서 `createPinOverlay`가 `mkPins`에 등록하며 `added`에 담는다. 레지스트리 변이와 delta 구성이 같은 루프에서 일어나 어긋날 여지가 없다. 등록 지점이 `createPinOverlay` 한 곳뿐임은 spec이 정규식 개수 1로 잠갔고, QA가 M10(full 모드가 delta만 등록)으로 killed 확인했다.

### 2.3 재-INIT 재바인딩 — **PASS (4개 분기 전부 실행 확인)**

`__muklogInit`의 순서 `new Map → me → resetMarkers() → ensureClusterer() → renderMarkers`(L326-348)가 계약대로다. dev 테스트가 AC11(none)·AC11-b(partial)만 덮어서 **QA가 나머지 분기를 직접 탐침**했다:

| 탐침 | 분기 | 결과 |
|---|---|---|
| P9 | **full 모드 재-INIT** | 클러스터러 1개 재사용 + 새 Map 재바인딩 + 3건 전량 재등록, 옛 오버레이 전부 `setMap(null)` ✅ |
| P10 | **`setMap` 없는 클러스터러** | 재-INIT에서 폐기→재생성(clusterers 2개), 모드 재확정 `partial`, ERROR 0 ✅ |
| P11 | **강등(none) 상태에서 재-INIT** | 클러스터러 부활(`partial`), 강등 때 직접 붙었던 오버레이 전부 `setMap(null)` → **이중 표시 0**, 새 오버레이는 `setMap` 직접 호출 0 ✅ |

빈 지도(리셋 누락) 경로는 M1로, 유령(제거 오버레이 잔존)은 M4로 각각 killed 확인.

### 2.4 **E4 강등 상태에서의 증분 렌더 (리더 지시 명시 항목)** — **PASS**

탐침 P12: `addMarkers` throw로 강등시킨 뒤(`mkClusterMode==='none'`) 이어서 증분 주입 → 신규 1건만 `createElement`, 유지 핀 `setMap` 호출 증가 0, 이탈 핀만 `setMap(null)`, 신규 핀만 `setMap(mkMap)`, 레지스트리 6건 정확. **강등 후에도 증분 렌더가 정확히 동작한다.**

강등이 delta가 아닌 **레지스트리 전량**을 재부착하는지(핀 통째 실종 방지)는 M5로 killed 확인(dev 테스트 AC10이 유지 핀 `setMapCalls` 길이 1을 단언).

---

## 3. 핀 계약 6종 불변 (리더 지시 #2) — **PASS**

| 계약 | 검증 |
|---|---|
| 이모지 `textContent` | spec 실행 단언(핀 계약 회귀 테스트) |
| 3-way className (`mk-pin` / `--nearby` / `--wish`) | 동일 |
| `SET_SELECTED` 활성 토글 | `__muklogSetSelected` 무변경(L385-395). 유지 핀 클래스·zIndex만 토글, 재생성 0 |
| `MARKER_TAP` + `stopPropagation` | spec `click()` 실행 단언 |
| `pinId` 추적 (`el.dataset.pinId`) | spec 실행 단언 |
| `zIndex` (active 5 / saved 3 / wish 2 / nearby 1) | `pinZIndex` 무변경, 생성 시점 옵션 + 토글 시 `setZIndex` 양쪽 단언 |

### 3.1 리스너 누수·중복 발화 — **PASS (QA 직접 탐침)**

dev 테스트는 el 동일성만 보고 **탭 발화 횟수는 안 본다**. QA가 직접 확인했다:

- **P1**: 3→5→4→6건으로 재렌더 3회를 거친 뒤 유지 핀 `p0`을 탭 → `MARKER_TAP` 정확히 **1건**. 리스너 중복 등록 0.
- **P2**: 재-INIT으로 재생성된 핀 탭 → **1건**. 옛 el의 클로저가 새 핀에 겹치지 않는다.

`addEventListener` 호출 지점이 `createPinOverlay` 한 곳뿐이고 유지 핀은 그 함수를 타지 않으므로 구조적으로도 중복 경로가 없다. 제거된 핀의 el은 레지스트리·오버레이 참조가 함께 끊겨 GC 대상이다(수동 `removeEventListener` 불필요).

### 3.2 선택 상태 소실 — **PASS**

`pinSig`에 `selected` 없음(B5) → 선택 중 재주입에도 재생성 0(spec 단언 + M2 계열). 선택 id와 같은 핀이 **새로** 생길 때 생성 시점에 active + zIndex 5 적용(L206-218) — QA M9(생성 시 active 재적용 제거)로 killed 확인.

---

## 4. RN diff 0 (리더 지시 #3, plan §12 DoD) — **PASS**

```
git diff --stat -- MapTabScreen useNearbyPlaces mapMessages searchNearby components  →  빈 결과
git status --porcelain src/  →  M mapHtml.spec.ts / M mapHtml.ts / ?? src/test/mapHtmlSandbox/
```

**B1 계약 무변경 확인(생산자↔소비자 동시 읽기)**:
- 생산자 `mapMessages.ts:33-36` — `buildSetMarkersScript({ markers })`가 `markers` **배열 전체**를 `JSON.stringify`해 주입. 부분 패치로 변질 0.
- 소비자 `mapHtml.ts:379-381` — `__muklogSetMarkers(payload)` → `renderMarkers(payload.markers)`. 시그니처·의미 그대로.
- WebView→RN 발신 메시지 type 전수: `READY`·`MARKER_TAP`·`MAP_TAP`·`BOUNDS_CHANGED`·`ERROR`(3곳) — **신규 0**. `parseMapMessage` 무변경과 정합.

---

## 5. 샌드박스의 번들 도달 0 (리더 지시 #4) — **PASS**

| 항목 | 확인 |
|---|---|
| 프로덕션 import | `mapHtmlSandbox` 참조는 **`mapHtml.spec.ts` 1건뿐**(전수 grep). 배럴 `index.ts`는 자기 재수출 |
| 위치 선례 | `src/test/`는 기존 테스트 전용 디렉터리(`renderWithTheme`·`setDevMode`) — 동일 성격 |
| jest 수집 | `jest-expo` 기본 testMatch(`__tests__/**` · `*.spec|test.*`)에 `mapHtmlSandbox.ts` 미매치. **스위트 199 불변이 실증** |
| `tsc` | exit 0 |

---

## 6. 뮤테이션 재현 (리더 지시 #6) — **dev 6종 + QA 추가 4종 전부 killed**

**dev 보고를 신뢰하지 않고 QA가 직접 재현했다.** 격리 방식: 스크래치패드(`/private/tmp/.../scratchpad/mut`, **`src/` 밖**)에 `mapHtml.ts`·샌드박스·스펙 사본 + `node_modules` 심링크, 스펙 파일명 `check.mutspec.ts`(testMatch 미매치), `npx jest --roots <격리경로> --testMatch '**/*.mutspec.ts'`로만 실행. **종료 후 디렉터리 삭제 확인.** 사본 baseline 77/77 green.

| # | 뮤턴트 | killed | fail 수 | dev 보고 대조 |
|---|---|---|---|---|
| M1 | `__muklogInit`에서 `resetMarkers()` 제거 | ✅ | 4 | 일치 |
| M2 | `pinSig`에서 lat/lng 제외 | ✅ | 2 | 일치 |
| M3 | 유지 판정 무시(항상 재생성) | ✅ | 13 | 일치 |
| M4 | `removed` 오버레이 detach 안 함 | ✅ | 7 | 일치 |
| M5 | 강등 시 delta만 재부착 | ✅ | 2 | 일치 |
| M6 | 모드 판정 `typeof` 가드 제거 | ✅ | 2 | 일치 |
| **M7** (QA 추가) | `resetMarkers`/`ensureClusterer` **순서 뒤집기** | ✅ | 1 | — |
| **M8** (QA 추가) | E1 early-return 제거 | ✅ | 2 | — |
| **M9** (QA 추가) | 생성 시 active 클래스 재적용 제거 | ✅ | 2 | — |
| **M10** (QA 추가) | full 모드가 delta만 `addMarkers` | ✅ | 2 | — |

**dev 보고는 fail 건수까지 정확했다.** M7·M10이 §6의 "재작성 4건"이 잠근 단언(순서 인덱스 비교 / `addMarkers(allPinOverlays())`)에 의해 죽은 점은, 그 재작성이 **죽은 단언이 아니라 실제로 하중을 받는다**는 직접 증거다.

---

## 7. 미검증 (통과로 처리하지 않음)

| # | 항목 | 사유 |
|---|---|---|
| U1 | **T0 실측** — 실 SDK의 `removeMarkers`/`redraw`/`nodraw` 실존 | dev·QA 모두 실행 수단 없음. 문서 근거만 확보. 세 메서드 전부 `typeof` 가드 뒤라 부재 시 자동 폴백하고 **폴백 경로가 테스트로 커버돼 있어 위험은 낮으나, 실제 확정 모드(`mkClusterMode`)를 아무도 모른다** |
| U2 | **디바이스 스모크 S1~S8** — 전부 미수행 | dev-notes §8에 체크리스트 존재(임의 pass 표기 없음, 정직). **S2(팬 시 깜빡임 0)·S5(선택 유지)·S6(재-INIT 후 빈 지도 0)가 이 슬라이스의 핵심 가치라 이것 없이는 "동작 확인"이 아니다** |
| U3 | 실 SDK의 `clear()`/`removeMarkers()`가 오버레이를 지도에서 실제로 떼는지 | 샌드박스는 호출만 기록. L2와 직결 — S3(줌 반복 시 유령 버블/이중 핀 0)이 권위 |

리더 지시대로 dev-notes §8 체크리스트에 **S2·S5·S6가 존재함을 확인**했다(굵게 강조까지 되어 있음).

---

## 8. qa-visual 미투입 판정 — **타당**

`mapHtml.ts` diff에서 `<style>` 블록·`MK_CLUSTER_STYLES`·`mkClusterStyle`·hex 값은 **한 글자도 바뀌지 않았고**, `el.className`·`pinZIndex`·`classList.add('mk-pin--active')` 라인은 `renderMarkers` → `createPinOverlay`로 **들여쓰기만 달라진 채 이동**했다(diff의 +/- 쌍이 동일 문자열). 렌더되는 최종 DOM이 동일하므로 킷 대조 비주얼 QA는 불필요하다. 단 **"외형이 이전과 동일한가"는 디바이스 스모크 S1의 회귀 항목으로 남는다**(plan §3.3과 동일 결론).

---

## 9. 발견 사항

### L1 — `applyOverlayDelta`의 `none` 분기만 예외 격리가 없다 (Low, 하드닝 권고)

**파일**: `src/features/map/mapHtml/mapHtml.ts:253-257`

`none` 분기(`setMap` 직접 호출)는 `try/catch` 밖에 있다. `partial`/`full`은 catch→강등으로 보호되고, `resetMarkers`(L288)·`demoteClusterer`(L245)는 **핀별 try/catch로 격리**돼 있는데 여기만 무방비다.

QA 탐침 P6으로 실측: `none` 모드에서 오버레이 하나의 `setMap`이 던지면 **예외가 `renderMarkers`를 거쳐 `__muklogSetMarkers` 밖으로 샌다**. RN 주입부(`mapMessages.ts:35`)는 `window.__muklogSetMarkers && window.__muklogSetMarkers(...)`로 try/catch가 없어 조용히 실패한다.

**진짜 문제는 예외 전파가 아니라 자기치유 실패다.** 예외 시점에 `mkPins`는 **이미 갱신을 마친 상태**(P6에서 `['p0','p1']` 확인)라, 붙지 못한 오버레이가 다음 주입에서 "유지"로 판정돼 **영원히 화면에 안 붙는다**. plan §4.1이 명령형 패치를 기각하며 내세운 "다음 주입 1회로 항상 자기 치유"라는 근거가 이 분기에서만 성립하지 않는다.

도달 가능성은 낮다(살아 있는 지도에서 `setMap`이 던질 이유가 없다). 그래서 블로커가 아니다.

**수정안** — 나머지 정리 경로와 같은 best-effort 원칙으로 통일한다:
```js
if (mkClusterMode === 'none') {
  for (var i = 0; i < removed.length; i++) { try { removed[i].setMap(null); } catch (e) {} }
  for (var j = 0; j < added.length; j++) { try { added[j].setMap(mkMap); } catch (e2) {} }
  return;
}
```

### L2 — 강등 경로에서 `removed` 오버레이의 탈착이 SDK 호출 성공에 전적으로 의존 (Low, 하드닝 권고)

**파일**: `src/features/map/mapHtml/mapHtml.ts:258-278`

`removed` 오버레이는 `renderMarkers` 2단계에서 **`mkPins`에서 이미 빠진** 상태로 `applyOverlayDelta`에 넘어온다. 그 시점 이후 유일한 참조는 지역 배열이므로, 여기서 못 떼면 **레지스트리에도 없고 화면에는 남는 영구 유령**이 된다.

QA 탐침으로 실측한 각 모드의 탈착 수단:

| 모드 | 탈착 수단 | 탐침 |
|---|---|---|
| `none` | `setMap(null)` 명시 | P3 — lockstep 확인 ✅ |
| `partial` | `removeMarkers(removed)` | — |
| `partial` + removeMarkers throw | **`demoteClusterer()`의 `clear()`에만 의존** (`removed`의 `setMapCalls` 길이 **0**) | P4 |
| `full` | **`clear()`에만 의존** (`removed`의 `setMapCalls` 길이 **0**) | P5 |

`clear()`가 정상 동작하면 문제없다(설계 의도). 다만 `demoteClusterer`의 `clear()`는 `try{}catch{}`로 **삼켜지므로**, `removeMarkers`와 `clear`가 **연달아 실패하는 이중 고장**에서 유령이 남는다. 실 SDK에서 그럴 개연성은 낮고, 이 경로 자체가 U3(미검증)에 걸려 있다.

**수정안** — `applyOverlayDelta`의 catch에서 강등 **전에** removed를 확실히 뗀다:
```js
} catch (e) {
  for (var k = 0; k < removed.length; k++) { try { removed[k].setMap(null); } catch (e3) {} }
  demoteClusterer();
}
```

### N1 — 파일명 ≠ 대표 export 심볼명 (Nit, 컨벤션)

**파일**: `src/test/mapHtmlSandbox/mapHtmlSandbox.ts`

`docs/code-convention.md:153` "파일명은 파일의 대표 export 심볼명과 일치시킨다(한 파일 = 한 대표 심볼)". 이 파일의 대표 export는 **`createMapSandbox`**다(나머지는 전부 `type`). 같은 디렉터리 선례는 정확히 일치한다 — `renderWithTheme.tsx`→`renderWithTheme`, `setDevMode.ts`→`setDevMode`.

**수정안**: 디렉터리·파일을 `createMapSandbox/createMapSandbox.ts`로 개명(import 2곳 갱신) 하거나, 스킬 성격상 디렉터리명을 유지하고 싶다면 이 예외를 파일 헤더 주석에 명시. **기능 영향 0**이므로 다음 지도 스프린트에 묶어도 된다.

### D1 — plan §7·B6 "삭제 라인 0" 문구는 §4.6과 양립 불가 (문서 정정, dev 자진 신고 타당)

dev-notes §6의 신고를 QA가 diff로 검증했다. 삭제된 것은 정확히 **4개 `it`**이고, 전부 폐기 심볼(`mkOverlays`·`clearMarkers`)에 문자열로 직접 묶여 있어 문장 그대로는 존속이 불가능하다. **완화 0**을 확인했고, 오히려 재작성본이 더 강하다는 것을 M7·M10이 실증한다(§6). **나머지 38건은 무수정.**

`sprint-planner`가 plan §7·B6 문구를 "기존 42건의 **의도** 보존 — 폐기 심볼에 묶인 단언은 후속 심볼 위에서 동등 이상으로 재작성"으로 정정하기를 권고한다.

---

## 10. 보안 · 비용 가드레일 — **PASS**

| 항목 | 확인 |
|---|---|
| Kakao Local API 호출 | **0 증가** — `searchNearby`·`useNearbyPlaces` diff 0 |
| Kakao Map SDK 로드 | 0 증가 — `sdk.src` 라인 무변경(`libraries=clusterer` 그대로) |
| Supabase Edge invoke / DB / Storage / Realtime | **0** — 마이그레이션·RPC·RLS·쿼리 변경 0건 |
| AWS | 미사용 |
| 폴링·타이머 | **신규 0.** `setTimeout`은 기존 INIT의 relayout/emitBounds 2건 그대로, 증분 로직에 타이머·인터벌 없음 |
| Kakao JS 키 | 코드·문서에 값 미기록(placeholder만). 리포트에도 미기록 |
| 디바이스 자원 | **감소** — 100건 유지 + 1건 유입 시 `createElement` 101→1회 (E11 테스트로 잠금, QA가 격리 사본에서 재확인) |
| E1/E12 반복 주입 | QA 탐침 P8 — 같은 집합 5회 재주입 시 클러스터러 호출 **0**, DOM 생성 0 |

---

## 11. 코드 컨벤션 — **PASS (N1 제외)**

| 규칙 | 결과 |
|---|---|
| `useCallback`/`useMemo` | 변경 3파일 모두 **0건** |
| `export function` | **0건** — 샌드박스 전 export가 화살표 const |
| named-object 인자 | `createMapSandbox({clusterer})`·`extractInlineScript({html})`·`createFakeElement({tagName})`·spec 헬퍼 전부 준수. `forEach`/`map`/`filter` 콜백은 외부 API 예외 |
| HTML 템플릿 내부 JS | ES5 `var`/`function` 유지 — plan B8의 명시적 예외, 기존 선례 계승 ✅ |
| 파일명 = 심볼명 | **N1 1건** |
| 가짜 SDK 생성자의 `function` 표현식 | `new`가 형태를 강제하는 외부 API 모사 — 파일 내 주석으로 예외 명시됨(L226-228) ✅ |

---

## 12. DoD 대조 (plan §12)

| # | 항목 | 상태 |
|---|---|---|
| 1 | T0~T9 전 작업, 모든 AC 충족 | ⚠️ **T0 미완**(U1), T1~T9 완료·AC1~AC16 전부 실행 커버 |
| 2 | `npm test` green · `tsc --noEmit` 0 · `node --check` | ✅ (앞 둘 QA 직접 실행. `node --check`는 spec이 대체 — 샌드박스가 스크립트를 **실행**하므로 문법 검증보다 강함) |
| 3 | spec 기존 42건 삭제·완화 0 | ⚠️ **삭제 4건 · 완화 0** — D1(문서 정정 필요, 품질 저하 아님) |
| 4 | 뮤턴트 M1~M6 killed + 격리 사본 삭제 | ✅ **QA 직접 재현**(+QA 추가 4종), 삭제 확인 |
| 5 | 디바이스 스모크 S1~S8 | ❌ **미수행**(U2) |
| 6 | RN 코드 diff 0 | ✅ |
| 7 | dev-notes · qa-report-logic 작성 | ✅ |

---

## 13. 후속 조치

| 대상 | 요청 |
|---|---|
| **사용자/리더** | **U2 디바이스 스모크 S1~S8 실행** — 특히 S2·S5·S6. 수행 시 WebView 콘솔에서 `mkClusterMode` / `typeof clusterer.removeMarkers` / `typeof clusterer.redraw`를 함께 찍어 **U1(T0)을 닫는다.** 확정 모드가 `full`이면 S8도 필수 |
| **developer** | L1(`mapHtml.ts:253-257` 핀별 try/catch) · L2(`mapHtml.ts:276-278` catch에서 removed 선탈착) 하드닝 — 둘 다 3줄. **선택 사항이며 이번 슬라이스 차단 아님.** N1(파일명)은 다음 지도 스프린트에 묶어도 무방 |
| **sprint-planner** | D1 — plan §7·B6 문구를 "의도 보존 재작성 허용"으로 정정 |
| **qa-visual** | 미투입 유지(§8) |

**로직 완료 표기 조건**: U2(디바이스 스모크 S2·S5·S6) 통과. 그 전까지 이 스프린트는 "로직 검증 통과 · 실기기 미확인" 상태다.

---

## 14. 재검증 (2026-08-19, 하드닝 반영 후)

§9의 지적 3건과 D1이 모두 반영돼 **소스가 §0 baseline에서 바뀌었으므로, 승인 대상이 달라진 만큼 전 항목을 다시 돌렸다.**

### 14.1 반영 확인

| # | 지적 | 반영 | 확인 |
|---|---|---|---|
| **L1** | `none` 분기 예외 격리 없음 | ✅ 적용 — **QA 제안보다 강함** | 핀별 try/catch에 더해 `forgetPinByOverlay(added[j])` 신설: 부착 실패 핀을 레지스트리에서 되돌려 다음 주입이 새로 만들게 한다. QA 제안은 예외만 삼켜서 **자기치유 실패는 그대로 남았을 것** — dev가 근본 원인(레지스트리 선행 갱신)까지 닫았다 |
| **L2** | 강등 시 `removed` 탈착이 `clear()`에만 의존 | ✅ 적용 | `applyOverlayDelta` catch에서 `demoteClusterer()` **전에** `removed`를 핀별 `setMap(null)` |
| **N1** | 파일명 ≠ 대표 export 심볼명 | ✅ 적용 | `src/test/mapHtmlSandbox/` → **`src/test/createMapSandbox/createMapSandbox.ts`**. `renderWithTheme`·`setDevMode` 선례와 정합 |
| **D1** | plan §7·B6 ↔ §4.6 모순 | ✅ 반영(planner) | §4.6에 "폐기 심볼에 묶인 기존 단언의 처리 방침" 블록 신설 · §6 T7·§9 B6를 형태 기준(diff 삭제 라인) → 실질 기준(의도 보존·완화 0·뮤테이션으로 하중 실증)으로 교체 · §6 T8에 M7·M10 편입 · §12 개정 이력 R1 기록 |

### 14.2 게이트 재실행

| 게이트 | 결과 |
|---|---|
| `npm test` | **199 suites / 2038 tests 전량 green** (2035 → +3) |
| `npm run typecheck` | exit 0 |
| spec it 개수 | 77 → **80** (L1 · L1-b · L2 전용 3건 추가) |
| spec 추가 삭제 | **0건** — 삭제는 §9 D1에서 검증한 기존 4건 그대로 |

### 14.3 뮤테이션 재실행 — **12종 전부 killed**

하드닝 후 코드로 격리 사본을 새로 만들어(스크래치패드, `src/` 밖, `*.mutspec.ts` testMatch 미매치, 종료 후 삭제) 전량 재실행했다. 사본 baseline 80/80 green.

| # | 뮤턴트 | fail 수 |
|---|---|---|
| M1~M6 (plan) | 기존 6종 | 4 / 2 / 14 / 8 / 2 / 2 |
| M7~M10 (qa-logic) | 순서 뒤집기 · E1 제거 · active 재적용 제거 · full delta만 | 1 / 2 / 2 / 2 |
| **M11 (신규)** | `forgetPinByOverlay(added[j])` 호출 제거 | **1** |
| **M12 (신규)** | L2의 `removed` 선탈착 루프 제거 | **1** |

M11·M12는 **하드닝 전용 뮤턴트**다 — 새로 추가된 3건(L1·L1-b·L2)이 죽은 단언이 아니라 실제로 하중을 받는다는 실증이다.

### 14.4 탐침 재실행 — **10종 전부 통과, 지적 2건이 실제로 닫힘**

| 탐침 | 하드닝 **전** | 하드닝 **후** |
|---|---|---|
| **P6*** `none` 모드 `setMap` throw | 예외가 `__muklogSetMarkers` 밖으로 전파 | **전파 0**, ERROR 발신 0 |
| **P4*** `partial`에서 `removeMarkers` throw | `removed`의 `setMapCalls` 길이 **0**(clear에만 의존) | **`setMap(null)` 직접 수신**, 유지 핀은 전량 재부착 |
| P1 리스너 중복 / P7 소유권 / P8 E1 / P9 full 재-INIT / P11 강등 후 재-INIT / P12 E4 강등 후 증분 | 통과 | **회귀 0** |
| **P13 (신규)** `forgetPinByOverlay`가 오버레이 신원으로만 매칭해 엉뚱한 핀을 지우지 않는가 | — | 통과 |

### 14.5 재검증 후 체크섬

| 파일 | SHA-256 |
|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | `33a53d1f…6253986c` |
| `src/features/map/mapHtml/mapHtml.spec.ts` | `bb3fd29d…8802b713` |
| `src/test/createMapSandbox/createMapSandbox.ts` | (개명 반영) |

QA는 이번에도 소스를 만지지 않았다. 격리 사본 삭제 확인, `src/` 안 임시 파일 0건.

### 14.6 재검증 판정

**§9의 L1·L2·N1과 D1이 전부 닫혔고, 회귀 0이다.** 남은 미검증은 §7 그대로 **U1(T0 실측)·U2(디바이스 스모크 S1~S8)·U3(실 SDK의 clear/removeMarkers 실동작)** 뿐이며, 셋 다 실기기가 유일한 권위라 코드 작업으로는 닫을 수 없다.

⚠️ 루프(`docs/loops/ux-improvements.md`)는 토큰 예산 초과로 종료됐고 종료 시점 기록은 "1 스위트 FAIL(중간 편집 상태)"이다. **QA 재검증 시점의 트리는 199/2038 green · tsc 0으로 정상**이므로, 그 기록은 편집 도중 스냅샷이며 현재 트리 상태와 다르다 — 인계 문서를 읽는 다음 세션이 오해하지 않도록 여기 명시한다.
