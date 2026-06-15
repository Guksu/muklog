# dev-notes — map-tab-nearby (지도 슬라이스 2: 일반 음식점 viewport 핀)

> developer 산출. plan.md §3 계약·§5 작업·§5-1 TDD·§7 경계면·§8 비용 가드레일 구현.
> **slice1 회귀 0**(전 757 테스트 green, `tsc --noEmit` clean). TDD(Red→Green) 준수.

## 0. 결과 요약
- `npm test`: **103 suites / 757 tests passed**. `npx tsc --noEmit`: **clean**.
- 신규 단위 테스트: parseMapMessage(증분) · boundsToRect · nearbyToMapMarkers · mergeMapMarkers · formatDistance · searchNearby · useNearbyPlaces · mapHtml(증분) · MapTabScreen(증분).
- Part A(1~6: 백엔드·로직·HTML) + Part B(7: MapTabScreen 배선) **모두 완료**. ui-publisher의 `NearbySpotCard`(props: placeName/categoryName/distanceText?)가 선행 제공돼 B까지 진행.

## 1. 변경/생성 파일

### 신규
| 파일 | 역할 |
|------|------|
| `supabase/functions/nearby-search/index.ts` | **신규 Edge Function**(Deno). `{sw,ne}`→Kakao `category.json?category_group_code=FD6&rect=lng,lat,lng,lat&size=15`(page 미사용) → `{ results: NearbyPlaceItem[] }` camelCase 정규화. `handleNearbySearch`·`normalizeNearbyDocuments` 분리 export. place-search 패턴 미러. |
| `src/features/map/boundsToRect.ts` (+spec) | BOUNDS_CHANGED sw/ne → Edge 요청 본문(패스스루 — 가드는 useNearbyPlaces 책임). |
| `src/features/map/nearbyToMapMarkers.ts` (+spec) | `NearbyPlaceItem[]`→`MapMarker[]`(saved:false). emoji=mapKakaoCategory→categoryEmoji(폴백 PIN_FALLBACK_EMOJI), 비유한 좌표 제외. |
| `src/features/map/mergeMapMarkers.ts` (+spec) | saved+nearby 머지. saved 우선, 좌표 근접(`MERGE_DEDUP_EPSILON=1e-4`≈11m) nearby 제외. |
| `src/features/map/formatDistance.ts` (+spec) | `number\|null`→`"320m"`/`"1.5km"`/`"1km"`/`""`(null). |
| `src/features/map/searchNearby.ts` (+spec) | `invoke('nearby-search',{body:{sw,ne}})` 래퍼. 에러 토큰(BOUNDS_REQUIRED/KAKAO_*/NEARBY_SEARCH_FAILED) 정규화 throw. searchPlaces 미러. |
| `src/features/map/useNearbyPlaces.ts` (+spec) | viewport 훅. 디바운스 500ms·양자화 캐시(4자리)·최소이동 임계(1e-3)·레이스 가드. `{setBounds, markers, items, status}`. |

### 증분(기존 보존)
| 파일 | 변경 |
|------|------|
| `src/features/map/types.ts` | `MapMarker.saved` `true`→`boolean`(폭 확장, pinsToMapMarkers 무변). `NearbyPlaceItem`·`NearbyPlacesStatus` 신설. `MapInboundType.BoundsChanged` 추가. `MapInboundMessage` 유니온에 `MARKER_TAP{saved:boolean}`·`BOUNDS_CHANGED{sw,ne}` 추가. |
| `src/features/map/parseMapMessage.ts` | MARKER_TAP `saved` 필수 boolean(누락/비boolean→null). BOUNDS_CHANGED 분기(sw/ne `{lat,lng}` 수치 검증, 잡음 null 흡수). `asCoords` 헬퍼. |
| `src/features/map/mapHtml.ts` | `.mk-pin--nearby` border `#B6ABA0`(saved=`#3366FF` primary). `m.saved` 분기 className. MARKER_TAP에 `saved: m.saved` 동봉. `emitBounds()`+`idle` 리스너→`BOUNDS_CHANGED{sw,ne}`(INIT의 relayout/setCenter idle이 첫 발화). |
| `src/features/muklog/errors.ts` | `MuklogErrorToken`에 `BoundsRequired:'BOUNDS_REQUIRED'`·`NearbySearchFailed:'NEARBY_SEARCH_FAILED'` 추가(KAKAO_*는 재사용). nearby 실패는 UI 메시지 미노출(조용히). |
| `src/features/map/components/index.ts` | `NearbySpotCard` re-export(ui-publisher 제공). |
| `src/navigation/screens/MapTabScreen.tsx` | 배선 증분(아래 §3). |

> `supabase/functions/place-search/index.ts` **무변경**(muklog-place 회귀 0). 시크릿 `KAKAO_REST_API_KEY` 재사용(신규 시크릿 0).

## 2. 계약 shape (camelCase 단일 출처)

```ts
// nearby-search Edge 응답 (성공 200)  { results: NearbyPlaceItem[] }  (0건이면 [])
type NearbyPlaceItem = {
  kakaoPlaceId: string; placeName: string; categoryName: string;
  categoryGroupCode: string;   // 항상 'FD6'
  lat: number; lng: number;
  distance: number | null;     // 문자열 m → number, rect center 없으면 null
};
// Edge 에러: 400 BOUNDS_REQUIRED / 500 KAKAO_KEY_MISSING / 502 KAKAO_REQUEST_FAILED  → { error: <TOKEN> }

// WebView → RN (parseMapMessage)
{ type:'MARKER_TAP'; id:string; saved:boolean }        // saved=muklogId / nearby=kakaoPlaceId
{ type:'BOUNDS_CHANGED'; sw:{lat,lng}; ne:{lat,lng} }   // idle viewport bbox

// useNearbyPlaces(): { setBounds({sw,ne}); markers: MapMarker[](saved:false); items: NearbyPlaceItem[]; status }
```

> **계약 보강(plan §3.5 대비)**: 훅이 `markers`만 노출하면 NearbySpotCard(placeName/categoryName/distance)를 그릴 수 없어 **`items: NearbyPlaceItem[]` 추가 노출**(card lookup용). `markers`는 `items`에서 파생(지도 핀용). MapTabScreen이 `items.find(kakaoPlaceId===id)`로 카드 데이터 조회 + `formatDistance`로 distanceText 생성. ui-publisher NearbySpotCard props 계약(placeName/categoryName/distanceText?)과 1:1 정합 — 비주얼 무변경.

## 3. MapTabScreen 배선 증분
- `useNearbyPlaces()` 추가. `markers = mergeMapMarkers({ saved: pinsToMapMarkers(pins), nearby: nearby.markers })` → INIT/SET_MARKERS에 머지 마커 주입.
- `BOUNDS_CHANGED` → `nearby.setBounds({sw,ne})`.
- nearby 마커 변경(또는 saved 변경) 시 `reinjectMarkersOnChange` useEffect(명명 함수)가 READY 이후 `SET_MARKERS` 재주입(slice1 경로 재사용, 신규 outbound 없음). 키=`markersKey`(id:saved 조인).
- 선택 상태 `{id, saved}` 쌍(id 충돌 방어). saved=true→`SelectedSpotCard`(기존) / false→`NearbySpotCard`(items lookup + formatDistance).
- **nearby 에러 회귀 0**: nearby `status='error'`여도 slice1 오버레이(로딩/권한/SDK 에러)·saved 카드 불변(머지에 빈 nearby만 들어감). 테스트로 확인.

## 4. §7 경계면 — 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 생산자 | 소비자 | 검증 파일 |
|--------|--------|-----------|
| 지도뷰 `BOUNDS_CHANGED{sw,ne}`(mapHtml `emitBounds`) | parseMapMessage → MapTabScreen → `nearby.setBounds` | parseMapMessage.spec(BOUNDS_CHANGED 정상/잡음), MapTabScreen.spec(setBounds 인자 일치) |
| `useNearbyPlaces` 디바운스/캐시/임계 | `searchNearby` 호출 횟수 | useNearbyPlaces.spec(다중이동 1회·동일bbox 0·임계 미만 0·stale·에러) — **비용 가드레일 강제** |
| `nearby-search` `{results}`(camel, distance) | searchNearby → nearbyToMapMarkers | searchNearby.spec(필드 1:1·에러 토큰·네트워크), nearbyToMapMarkers.spec(매핑·폴백·NaN 제외·distance 보존) |
| nearbyToMapMarkers(saved:false)+pinsToMapMarkers(saved:true) | mergeMapMarkers | mergeMapMarkers.spec(좌표 근접 dedup·비겹침·epsilon 경계·빈) |
| mergeMapMarkers 결과 | 지도뷰 SET_MARKERS | MapTabScreen.spec(머지 마커 m1+k1+saved:false 주입) |
| 지도뷰 `MARKER_TAP{id,saved}` | MapTabScreen 카드 분기 | MapTabScreen.spec(saved:true→SelectedSpotCard / false→NearbySpotCard) |
| mapKakaoCategory/categoryEmoji(기존) | nearbyToMapMarkers emoji | nearbyToMapMarkers.spec(한식→noodle·불명확→폴백) — 기존 매핑 재사용(중복 정의 0) |
| `KAKAO_REST_API_KEY` 시크릿 | nearby-search | 응답/클라 번들 키 미노출(Edge env만, place-search 원칙) |
| slice1 자산 | slice2 증분 | pinsToMapMarkers.spec(saved:true 무변경), MapTabScreen.spec slice1 케이스 전부 green |

## 5. 라이브 스모크 체크리스트 (`npm run ios:sim` — 디바이스/serve 필요)
선행: `supabase functions deploy nearby-search` + `KAKAO_REST_API_KEY` 시크릿 확인(place-search와 동일 — 이미 설정됨). 카카오 콘솔 Local API 활성 확인.

1. [ ] 지도 진입 → INIT 직후 idle 1회 발화로 초기 viewport에 **웜그레이(#B6ABA0) 주변 핀** 등장.
2. [ ] 지도 드래그/줌 종료 → 새 영역 주변 핀 갱신(이동 중엔 안 뜨고 멈춘 뒤 ~0.5s).
3. [ ] 연속 플링(관성) 후 1회만 네트워크 호출(디바운스 체감) — 디버그 네트워크 로그.
4. [ ] saved 핀(primary #3366FF)과 nearby 핀(웜그레이) **색 구분** 확인.
5. [ ] nearby 핀 탭 → 하단 `NearbySpotCard`(이름·카테고리·거리 "320m"). 거리 결측이면 카테고리만.
6. [ ] saved 핀 탭 → `SelectedSpotCard`(별점·area) — slice1 불변.
7. [ ] 동일 영역 왕복(A→B→A) → A 재방문 시 네트워크 0(양자화 캐시 히트).
8. [ ] 바다/산 등 빈 viewport → nearby 핀 0(에러 아님), saved 핀·지도 유지.
9. [ ] (선택) Edge 강제 실패(키 임시 미설정) → nearby 핀만 사라지고 지도/saved/카드 불변(차단 아님).

## 6. Edge Function 배포 · verify_jwt 정책
- `nearby-search`는 `config.toml` 부재이므로 **배포 기본값(verify_jwt=true)** = place-search와 동일 정책(인증 사용자만 호출 — 쿼터 보호, plan §8).
- 배포: `supabase functions deploy nearby-search`. 시크릿 추가 불필요(KAKAO_REST_API_KEY 재사용).
- ⚠️ Deno 런타임 — 앱 jest/tsc 대상 아님(`supabase/functions` exclude/ignore). 핸들러·정규화 로직은 **클라 측 계약 모킹**(searchNearby.spec·nearbyToMapMarkers.spec)으로 shape 검증 + `supabase functions serve` 스모크.

## 7. 비용 가드레일 (§8 — 테스트로 강제)
- ✅ viewport bbox(rect)만 · `size=15` · **page 미사용**(페이지네이션 금지) — Edge 코드 + useNearbyPlaces.spec 호출 횟수.
- ✅ 디바운스 500ms · 양자화 캐시(재방문 0) · 최소이동 임계 — useNearbyPlaces.spec 5케이스(다중이동 1회/동일bbox 0/임계 미만 0/stale/에러).
- ✅ REST 키 노출 0(Edge env만). ✅ DB 미저장(표시 전용). ✅ AWS 0.

## 8. 미해결 / 후속(OUT 명시 — plan §9.4·§10)
- nearby 카드→먹로그 추가(MuklogEditor 프리필), 정확 dedup(RPC kakao_place_id 투영), 카테고리 필터 칩, 클러스터링 — 전부 후속 슬라이스(이번 OUT).
- `nearby-search` Deno 단위 테스트 미구동(환경 한계) — 클라 모킹 + serve 스모크로 대체(place-search 선례 동일).
