# QA 리포트 — 로직·통합 정합성 (nearby-accumulate)

> 검증자: qa-logic. 기준: `plan.md`(계약·인수조건) · `dev-notes.md` · `docs/testing-strategy.md` · `docs/code-convention.md`.
> 방법: 생산자↔소비자 양쪽 동시 읽기(누적 모듈↔useNearbyPlaces↔파생) + **git diff로 API 경로 불변 직접 확인** + 종료 기준 직접 실행. lean 스프린트(비주얼 무변경 확인만).
> **판정: 통과(PASS) — 블로커 0. 경미(비차단) 관찰 2건.**

## 0. 종료 기준 직접 실행 결과

| 게이트 | 결과 |
|--------|------|
| `npx tsc --noEmit` | **exit 0**(클린) |
| `npx jest`(전체) | **154 suites / 1503 tests green**(dev-notes 총계와 일치) |
| `accumulateNearbyItems` + `useNearbyPlaces` 스펙 | **24/24 green** |

## 1. 누적 순수 모듈 `accumulateNearbyItems` — PASS
- **dedup**: `Map<kakaoPlaceId, item>`로 id 기준 중복 제거(`accumulateNearbyItems.ts:28-36`). kakaoPlaceId dedup은 mergeMapMarkers의 좌표 epsilon dedup과 **별개 레이어**(§7 핵심 구분 확인).
- **recency/LRU**: 재수신 시 `merged.delete(id); merged.set(id, item)`으로 최신 데이터 갱신 + 최근 이동(`:34-35`). 삽입순서 Map으로 "가장 오래된=맨 앞" 보장.
- **cap 퇴출**: `while size > cap: delete oldest(keys().next())`(`:38-42`), `oldest===undefined` 가드로 빈 Map 안전. 길이=cap 유지.
- **순수성/throw 0**: 새 Map 구성·`[...merged.values()]` 새 배열 반환(`:43`), prev/next 미변형. 어떤 throw도 없음.
- 테스트 8/8이 각 semantics 실증: 합집합·dedup 미증가·recency 이동(옛→새이름·['2','1'])·cap LRU(['2','3','4'])·**재수신 항목이 퇴출 면함**(['3','1','4'], 2 퇴출)·빈 next(=prev)·빈 prev(=next capped)·순수성. 형식적 아님(LRU 순서를 정확히 단언 — 구현 결함 시 red).

## 2. 적용 3지점 + **API 경로 불변** (비용 가드레일 최우선) — PASS
- **git diff 직접 확인**: `useNearbyPlaces.ts` 변경은 정확히 (1) import 추가, (2) `NEARBY_ACCUM_CAP=100` 상수, (3) 캐시 히트 `setItems(cached)`→`setItems((prev)=>accumulate(...))`, (4) 성공 `setItems(nextItems)`→`setItems((prev)=>accumulate(...))`, (5) 에러 `setItems([])` 삭제(`setStatus('error')` 유지), (6) 주석. **디바운스 500ms·양자화 캐시·최소이동 임계·레이스 seq·`lastQueriedRef`·`requestSeqRef`·delay 산식·`cacheRef.set(key, nextItems)`(원본 15컷 저장)은 한 줄도 안 바뀜.**
- **레이스 가드 위치 불변**: `seq !== requestSeqRef.current` 폐기가 accumulate **전에** 실행(`useNearbyPlaces.ts:127`) → 늦은 stale 응답이 누적을 오염시키지 않음.
- **가드레일 스펙 무변경 확인**: 기존 12개 가드레일 테스트(연속이동 1회 수렴·재방문 invoke 0·임계 미호출·stale 폐기·첫조회 0틱 등)는 git diff상 **미변경**(diff는 import 라인 + 에러 테스트 교체 + 신규 4건 append만 건드림). T3 신규 테스트가 재방문 시 `searchMock` 정확히 2회(캐시 히트가 invoke 0)를 단언해 **invoke 횟수 불변**을 적극 증명. 폴링/Realtime/타이머 0, Kakao Local 호출 증가 0, 페이지네이션 미도입, AWS 0.

## 3. 에러 정책 전환의 의도성 — PASS (무단 약화 아님)
- 기존 `'에러: reject → status=error, markers 비움'`(구 `setItems([])` 팝아웃) 1건만 T4 `'에러 시 누적 유지 + status=error'`로 교체. plan §3.4 + dev-notes §3이 **명시적으로 문서화한 의도적 정책 전환**과 일치: 한 area 실패가 확인된 다른 area 핀을 지울 이유 없고 nearby 에러는 애초에 silent(차단 배너 아님). T4는 성공 누적(a,b) 후 다른 area 실패 시 items 불변 + status='error'를 단언 — 정책을 실제 검증하는 유의미한 테스트. **무단 테스트 약화 아님.**

## 4. 경계면 파생 정합 — PASS
- **누적 items ↔ nearbyToMapMarkers ↔ mergeMapMarkers ↔ SET_MARKERS**: `markers = nearbyToMapMarkers({ items })`(코드 그대로, `useNearbyPlaces.ts:148`)이 누적 items에서 파생. mergeMapMarkers의 saved↔nearby 좌표 dedup은 별개 레이어라 누적분에도 그대로 적용(MapTabScreen·mergeMapMarkers·nearbyToMapMarkers 미변경, git status 확인). markersKey 재주입은 누적 증가 시 발화(현행 구조 불변).
- **누적 items ↔ NearbySpotCard lookup**: MapTabScreen `nearby.items.find(kakaoPlaceId)`(무변경)가 누적 items에서 조회 — 누적으로 후보가 늘어도 id 조회 정합.
- **map-pin-select T7 상호작용**: 누적 유지로 선택된 nearby 핀이 계속 렌더 → 선택 소실 빈도 **감소**(긍정 상호작용). cap 퇴출로 items에서 사라지면 MapTabScreen `clearSelectionWhenNearbyGone`(직전 스프린트, 무변경)이 `nearby.items` 부재 감지 → selected 정리 + 카드 닫힘. SET_SELECTED/markersKey 독립 채널이라 충돌 0. **양쪽 구성 동작(누적 cap 퇴출이 items에서 제거 + T7이 items 부재 시 정리)이 각각 green**이라 상호작용 성립.

## 5. 레이스 + 함수형 setItems — PASS
- `setItems((prev)=>accumulate({prev, next, cap}))`이 최신 커밋 items를 prev로 읽어 병합 → React 순차 적용으로 누적 정합. stale 응답은 seq 가드로 accumulate 전 폐기되어 최대 1개(최신) 응답만 병합. 
- **관찰(무해)**: 캐시 히트 경로는 동기라 seq 가드를 거치지 않으나, 누적 정책에서는 캐시 히트와 in-flight 비동기 응답이 **둘 다 병합돼도 손실 없음**(구 교체 정책의 잠재 race가 누적에서 오히려 완화). 회귀 아님.

## 6. TDD·회귀·컨벤션 — PASS
- 신규 테스트 유의미(T2 union+dedup, T3 캐시누적+invoke불변, T4 에러누적유지, T5 cap LRU — 각각 구현 결함 시 red). 회귀 0: nearbyToMapMarkers·mergeMapMarkers·boundsToRect·searchNearby·MapTabScreen·map-pin-select 스펙 무변경 green(전체 1503 green).
- 컨벤션: 변경 파일에 `useCallback`/`useMemo` 실호출 0(grep 매치는 "useMemo 지양" 주석 1건). 화살표 const·named-object 인자(`{prev,next,cap}`)·JSDoc·enum-style 상수(`NEARBY_ACCUM_CAP`)·파일명=심볼명 준수.

## 7. 비주얼 무변경 확인 — PASS
- git 변경 스코프 = `useNearbyPlaces.ts`/`.spec.ts` 수정 + `accumulateNearbyItems/` 신규 + 스프린트 docs. UI/theme/킷/컴포넌트/mapHtml 파일 변경 0 → 비주얼 변화 0 전제 충족(핀 색·도형·카드·범례 불변).

## 8. 경미 관찰 (비차단 — 후속 판단용)

1. **dev-notes 테스트 카운트 부정확** — dev-notes가 `useNearbyPlaces.spec.ts: 20/20`·"기존 가드레일 16(무변경)"이라 기재했으나 **실제는 16 tests 총계(기존 가드레일 12 + 신규 4: T2·T3·T4·T5, T4는 구 에러 테스트 교체)**. 전체 총계(154 suites / 1503 tests)는 정확. 코드·검증에는 영향 없는 **문서 카운트 오기**이나, 리더가 "가드레일 16개 무변경" 확인을 요청했으므로 정정: **가드레일 12개가 무변경 green이며 경로 불변은 git diff로 직접 확인됨**(카운트 착오는 "누적 후 전체 16"과 "가드레일 수"의 혼동). dev-notes §4·§5 수치 정정 권장(비차단).
2. **T8(map-pin-select 상호작용) 전용 통합 테스트 부재** — cap 퇴출→선택 정리 end-to-end 단일 테스트는 없고, 구성 동작(accumulate cap 퇴출이 items 제거 + MapTabScreen T7이 items 부재 시 정리)이 **각각 분리 테스트**로 커버. 통합 테스트는 MapTabScreen+실 useNearbyPlaces 결합이 필요(무거움)이며 각 레이어가 green이라 실질 위험 낮음. 후속에 통합 케이스 1개 추가 고려(비차단).

## 9. 미검증(단위 불가 — 이월 적절)
- 실제 WebView 누적 오버레이 렌더·성장 시 SET_MARKERS 전체 재생성 flicker·cap(100) 근처 팬 성능/튜닝 → **디바이스 스모크(dev/시뮬)**. WebView 렌더/타이밍은 jest 단위로 안 드러남(메모리 `map-perf-bottleneck`·`qa-layout-blind-spot`). cap 최종값 확정은 스모크 몫. "통과" 아닌 "이월"로 분류.

## 결론
누적 semantics(dedup·LRU·cap·순수성)·**API 경로 불변(git diff 직접 확인 — 디바운스/캐시/임계/seq/invoke 무변경)**·에러 정책 전환 의도성·파생 정합·map-pin-select 상호작용·레이스 안전·회귀·컨벤션·비주얼 무변경 전 항목 **통과**. 종료 게이트(tsc 0 · jest 1503 green) 직접 실행 확인. 블로커 없음 — 스프린트 "로직 완료" 처리 가능. 경미 관찰 2건(dev-notes 카운트 오기·T8 통합 테스트 부재)은 모두 비차단.
