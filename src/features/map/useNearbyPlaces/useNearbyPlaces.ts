// src/features/map/useNearbyPlaces/useNearbyPlaces.ts
// 주변 음식점 로딩 상태 기계 — 선로딩 + 영속 캐시(SWR) + 명시 재검색 (map-pin-loading plan §4.4).
//
// 생산자: searchNearby(nearby-search invoke 래퍼) + nearbyCache(AsyncStorage 하이드레이션).
// 소비자: MapTabScreen(머지 후 INIT/SET_MARKERS + 카드 + "이 지역에서 검색" 버튼).
//
// ★ 이 스프린트가 바꾼 것: **팬 중 자동 조회를 폐기했다.**
//   setBounds(BOUNDS_CHANGED)는 더 이상 "조회하라"가 아니라 "현재 뷰포트는 여기다"라는 통지다.
//   조회를 태우는 경로는 셋뿐이다 — ① 선로딩(preload, 마운트당 1회) ② 첫 화면 확정 보정(correction, 1회)
//   ③ 사용자가 버튼을 누르는 research(). 그 외 어떤 팬·줌도 네트워크를 태우지 않는다(C5).
//   덕분에 세션당 호출 수가 "사용자 팬 횟수"가 아니라 "사용자 의도 횟수"에 비례한다(§10).
//
// 비용 가드레일(테스트로 강제 §5-1 C1~C9):
//   - 첫 진입 허용분: 사용자 액션 없는 invoke는 **최대 2회**(선로딩 1 + 보정 1). 그 외 경로는 ≤1.
//   - 양자화 bbox 캐시: 소수 4자리 키 → 동일 영역 재방문 시 invoke 0(인메모리 + AsyncStorage 영속).
//   - 0틱 leading-edge 타이머: idle 다발(INIT 직후 0ms/60ms 이중 emit)을 마지막 1건으로 수렴 + cleanup 회수.
//   - 레이스 가드: requestSeqRef 증가 → 늦게 온 stale 응답 폐기.
//   - 에러: status='error'만(누적 유지). 재시도 어포던스는 재검색 버튼이다 —
//     이미 조회한 뒤의 실패는 lastQueried를 갱신하지 않아 드리프트가 살아 버튼이 남고,
//     **첫 조회 실패는 lastQueried 자체가 없으므로** status==='error'가 노출을 책임진다(map-feedback U4).
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { accumulateNearbyItems } from '../accumulateNearbyItems';
import { boundsToRect } from '../boundsToRect';
import { bboxSpan, exceedsResearchThreshold, type BboxSpan, type Bounds } from '../bboxDrift';
import {
  NEARBY_CACHE_VERSION,
  NEARBY_CACHE_WRITE_DEBOUNCE_MS,
  loadNearbyCache,
  saveNearbyCache,
  type NearbyCacheArea,
} from '../nearbyCache';
import { nearbyPreloadBbox } from '../nearbyPreloadBbox';
import { nearbyToMapMarkers } from '../nearbyToMapMarkers';
import { NearbyInvokeTrigger, NearbyTraceEvent, traceNearby } from '../nearbyTrace';
import { searchNearby } from '../searchNearby';
import { type Coords, type MapMarker, type NearbyPlaceItem, type NearbyPlacesStatus } from '../types';

/**
 * 첫 조회 leading-edge 지연(ms) — 0틱(다음 매크로태스크)에 즉시 발사.
 * 0이라도 setTimeout이므로 cleanup의 clearTimeout 대상 → 초기 idle 다발이 마지막 1건으로 수렴하고
 * 언마운트 시 유령 invoke가 남지 않는다(E8).
 */
export const NEARBY_FIRST_DELAY_MS = 0;
/** 양자화 자리수 — 소수 4자리(≈11m) 반올림 키로 캐시 정규화. */
const NEARBY_QUANTIZE_DECIMALS = 4;
/**
 * 세션 내 nearby 핀 누적 상한. 뷰포트당 최대 15건 × ~7뷰포트 고유 가게.
 * 초과 시 LRU로 오래된 것부터 퇴출 — WebView CustomOverlay 수를 팬 지연 우려 수준 아래로 bound.
 */
export const NEARBY_ACCUM_CAP = 100;
/**
 * 하이드레이션 area 유지 반경(첫 bbox span의 배수) — 이 밖의 area는 폐기한다.
 * 여행·이동 후 재진입에서 타 도시 핀이 누적·카드 lookup을 오염시키는 것을 차단한다(E4).
 */
export const NEARBY_HYDRATE_MAX_SPANS = 3;

/** 조회가 실제로 적용된 area(양자화 키 + 그때의 bbox) — 재검색 임계 비교의 기준선. */
type QueriedArea = { key: string; bounds: Bounds };

/** bbox를 양자화 키로 정규화한다(소수 N자리 반올림 → 동일 영역 캐시 히트). */
const quantizeKey = ({ bounds }: { bounds: Bounds }): string => {
  const round = (n: number): number => {
    const factor = 10 ** NEARBY_QUANTIZE_DECIMALS;
    return Math.round(n * factor) / factor;
  };
  return `${round(bounds.sw.lat)},${round(bounds.sw.lng)},${round(bounds.ne.lat)},${round(bounds.ne.lng)}`;
};

/** bbox 중심 좌표(prune 거리·재구성 기준). */
const centerOf = ({ bounds }: { bounds: Bounds }): Coords => ({
  lat: (bounds.sw.lat + bounds.ne.lat) / 2,
  lng: (bounds.sw.lng + bounds.ne.lng) / 2,
});

export type UseNearbyPlacesResult = {
  /** 지도 핀용 마커(kind:'nearby'). 실패/빈 → [] */
  markers: MapMarker[];
  /** NearbySpotCard lookup용 누적 항목. 실패/빈 → [] */
  items: NearbyPlaceItem[];
  status: NearbyPlacesStatus;
  /**
   * BOUNDS_CHANGED 싱크. **네트워크를 태우지 않는다** — 드리프트 판정 + span 1회 기록만 한다.
   * 예외 2가지: 이 마운트에서 아직 한 번도 조회하지 않았다면 여기서 첫 조회를 발사하고(0틱),
   * 선로딩 bbox와 첫 실제 뷰포트가 임계 초과로 어긋나면 1회만 보정 조회한다.
   */
  setBounds: (next: Bounds) => void;
  /** 탭 진입 즉시 1회. 하이드레이션 완료 뒤 실행되도록 내부 큐잉된다. 2회차 이후 호출은 no-op. */
  preload: (args: { bbox: Bounds }) => void;
  /** "이 지역에서 검색" 탭 — 현재 bbox로 1회 조회. in-flight면 no-op(연타 가드). */
  research: () => void;
  /** 버튼 노출 여부. 부모는 이 값만 보고 렌더한다(컴포넌트는 자기 노출 조건을 모른다). */
  researchAvailable: boolean;
};

/**
 * 주변 음식점을 선로딩·영속 캐시·명시 재검색 모델로 관리하는 훅.
 * 지도 부팅과 병렬로 선로딩하고(preload), 재진입 시 캐시로 즉시 표시하며, 이후 갱신은 research()로만 한다.
 * @returns markers/items/status + setBounds·preload·research·researchAvailable
 */
export const useNearbyPlaces = (): UseNearbyPlacesResult => {
  const [items, setItems] = useState<NearbyPlaceItem[]>([]);
  const [status, setStatus] = useState<NearbyPlacesStatus>('idle');
  // 버튼 노출 판정은 렌더에서 계산하므로 두 값은 state여야 한다(ref만이면 값이 바뀌어도 버튼이 안 뜬다).
  const [lastQueried, setLastQueried] = useState<QueriedArea | null>(null);
  const [currentBounds, setCurrentBounds] = useState<Bounds | null>(null);

  const mountedRef = useRef(true);
  // 양자화 키 → area. Map의 삽입 순서를 LRU(오래된 것 → 최근)로 쓴다 — 영속 시 오래된 것부터 퇴출된다.
  const areasRef = useRef<Map<string, NearbyCacheArea>>(new Map());
  const lastQueriedRef = useRef<QueriedArea | null>(null);
  const currentBoundsRef = useRef<Bounds | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const hydratedRef = useRef(false);
  const pendingPreloadRef = useRef<Bounds | null>(null);
  const preloadCalledRef = useRef(false);
  const preloadBboxRef = useRef<Bounds | null>(null);
  // 첫 조회 허용분(first-load allowance) — 마운트당 1회. 소비 주체는 preload 또는 첫 setBounds.
  const firstLoadUsedRef = useRef(false);
  // 보정 조회 1회권 — 선로딩이 실제로 bbox를 확정했을 때만 장전되고, 첫 setBounds 판정에서 소진된다.
  const correctionArmedRef = useRef(false);
  const prunedRef = useRef(false);
  const spanRef = useRef<BboxSpan | null>(null);
  const spanRecordedRef = useRef(false);
  const userIdRef = useRef('');
  const queryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryTriggerRef = useRef<NearbyInvokeTrigger>(NearbyInvokeTrigger.FirstBounds);
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 조회가 적용된 area를 기록한다(ref+state 동시) — ref는 async 흐름용, state는 버튼 재렌더용. */
  const commitQueried = ({ key, bounds }: QueriedArea): void => {
    lastQueriedRef.current = { key, bounds };
    setLastQueried({ key, bounds });
  };

  /** 보유 area 전체를 LRU 순으로 접어 누적 items를 만든다(하이드레이션·prune 후 재계산용). */
  const foldAreas = (): NearbyPlaceItem[] =>
    Array.from(areasRef.current.values()).reduce<NearbyPlaceItem[]>(
      (acc, area) => accumulateNearbyItems({ prev: acc, next: area.items, cap: NEARBY_ACCUM_CAP }),
      [],
    );

  /** 현재 보유 area를 그대로 영속한다(best-effort, no-throw). userId 미확보면 no-op. */
  const persistCache = (): void => {
    const userId = userIdRef.current;
    if (!userId) return;
    void saveNearbyCache({
      userId,
      payload: {
        version: NEARBY_CACHE_VERSION,
        savedAt: Date.now(),
        span: spanRef.current,
        areas: Array.from(areasRef.current.values()),
      },
    });
  };

  /** 캐시 쓰기를 디바운스한다 — 연속 조회를 1회 쓰기로 수렴(언마운트 시엔 flush, 취소 아님). */
  const scheduleCacheWrite = (): void => {
    if (!userIdRef.current) return;
    if (writeTimerRef.current) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(function flushNearbyCache() {
      writeTimerRef.current = null;
      persistCache();
    }, NEARBY_CACHE_WRITE_DEBOUNCE_MS);
  };

  /** 대기 중인 0틱 조회를 회수한다(더 최신 bbox로 재타겟하거나 캐시 히트로 불필요해졌을 때). */
  const clearQueryTimer = (): void => {
    if (queryTimerRef.current === null) return;
    clearTimeout(queryTimerRef.current);
    queryTimerRef.current = null;
  };

  /** 세션 첫 뷰포트의 span만 기록한다 — INIT 직후 첫 emit은 구조적으로 항상 level 5라 다음 세션 추정에 재사용 가능하다. */
  const recordSpanOnce = ({ bounds }: { bounds: Bounds }): void => {
    if (spanRecordedRef.current) return;
    spanRecordedRef.current = true;
    const span = bboxSpan({ bounds });
    if (!Number.isFinite(span.lat) || !Number.isFinite(span.lng)) return;
    if (span.lat === 0 || span.lng === 0) return;
    spanRef.current = span;
    scheduleCacheWrite();
  };

  /** 캐시 히트 적용 — invoke 0. 누적에 병합하고(교체 아님) LRU 최신으로 올린다. */
  const applyCachedArea = ({ key, bbox }: { key: string; bbox: Bounds }): void => {
    const area = areasRef.current.get(key);
    if (!area) return;
    areasRef.current.delete(key);
    areasRef.current.set(key, area);
    traceNearby({ event: NearbyTraceEvent.CacheHit, detail: { key } });
    setItems((prev) => accumulateNearbyItems({ prev, next: area.items, cap: NEARBY_ACCUM_CAP }));
    setStatus('ready');
    commitQueried({ key, bounds: bbox });
  };

  /** 첫 bbox가 확정될 때 1회만: 하이드레이션된 area 중 span 3배 밖(=다른 동네)을 폐기한다(E4). */
  const pruneDistantAreas = ({ bbox }: { bbox: Bounds }): void => {
    if (prunedRef.current) return;
    prunedRef.current = true;
    if (areasRef.current.size === 0) return;
    const span = bboxSpan({ bounds: bbox });
    if (!Number.isFinite(span.lat) || !Number.isFinite(span.lng)) return;
    const center = centerOf({ bounds: bbox });
    const maxLat = span.lat * NEARBY_HYDRATE_MAX_SPANS;
    const maxLng = span.lng * NEARBY_HYDRATE_MAX_SPANS;
    let removed = 0;
    areasRef.current.forEach((area, key) => {
      const areaCenter = centerOf({ bounds: area.bounds });
      const farLat = Math.abs(areaCenter.lat - center.lat) > maxLat;
      const farLng = Math.abs(areaCenter.lng - center.lng) > maxLng;
      if (farLat || farLng) {
        areasRef.current.delete(key);
        removed += 1;
      }
    });
    if (removed > 0) setItems(foldAreas());
  };

  /**
   * 조회 1건을 시작한다 — 캐시 히트면 invoke 0, miss면 0틱(또는 즉시) 발사.
   * research만 in-flight 가드로 막는다(연타). 자동 경로(보정)는 레이스 가드가 처리한다.
   */
  const startQuery = ({
    bbox,
    trigger,
    defer,
  }: {
    bbox: Bounds;
    trigger: NearbyInvokeTrigger;
    defer: boolean;
  }): void => {
    pruneDistantAreas({ bbox });
    const key = quantizeKey({ bounds: bbox });

    if (areasRef.current.has(key)) {
      // 이미 가진 영역(직전 조회 포함) — 네트워크 0. 대기 중 조회가 있었다면 불필요해졌으므로 회수한다.
      firstLoadUsedRef.current = true;
      clearQueryTimer();
      applyCachedArea({ key, bbox });
      return;
    }
    if (trigger === NearbyInvokeTrigger.Research && inFlightRef.current) return; // 연타 가드(A3-7).
    firstLoadUsedRef.current = true;

    const fire = (): void => {
      if (!mountedRef.current) return;
      inFlightRef.current = true;
      const seq = (requestSeqRef.current += 1); // 이전 요청 무효화(레이스 가드).
      const startedAt = Date.now();
      setStatus('loading');
      traceNearby({ event: NearbyTraceEvent.InvokeStart, detail: { key, trigger } });
      searchNearby(boundsToRect({ sw: bbox.sw, ne: bbox.ne }))
        .then(function onResults(nextItems) {
          if (seq !== requestSeqRef.current) return; // stale 폐기.
          inFlightRef.current = false;
          if (!mountedRef.current) return;
          traceNearby({
            event: NearbyTraceEvent.InvokeEnd,
            detail: { key, ms: Date.now() - startedAt, count: nextItems.length, ok: true },
          });
          areasRef.current.set(key, { key, bounds: bbox, items: nextItems });
          commitQueried({ key, bounds: bbox });
          // 교체가 아니라 누적 병합 — 같은 위치 줌/이동 시 이전 핀 유지(팝인/소실 해소).
          setItems((prev) => accumulateNearbyItems({ prev, next: nextItems, cap: NEARBY_ACCUM_CAP }));
          setStatus('ready');
          scheduleCacheWrite();
        })
        .catch(function onError() {
          if (seq !== requestSeqRef.current) return; // stale 폐기.
          inFlightRef.current = false;
          if (!mountedRef.current) return;
          traceNearby({
            event: NearbyTraceEvent.InvokeEnd,
            detail: { key, ms: Date.now() - startedAt, count: 0, ok: false },
          });
          // 누적 유지(items 미변경) + lastQueried 미갱신 → 버튼이 남아 재시도 어포던스가 된다(E12).
          //   첫 조회 실패라 lastQueried가 아예 없는 경우는 status='error' 자체가 노출을 연다(map-feedback U4).
          setStatus('error');
        });
    };

    if (!defer) {
      fire();
      return;
    }
    clearQueryTimer();
    queryTriggerRef.current = trigger;
    queryTimerRef.current = setTimeout(function runNearbySearch() {
      queryTimerRef.current = null;
      fire();
    }, NEARBY_FIRST_DELAY_MS);
  };

  /** 선로딩 실행 — 캐시가 관측한 실제 span이 있으면 그 폭으로 bbox를 재구성한다(폴백 근사보다 정확, §4.2). */
  const runPreload = ({ bbox }: { bbox: Bounds }): void => {
    // 허용분이 이미 첫 setBounds에 소비됐다면(=실측 뷰포트로 조회 완료) 추정 bbox 선로딩은 불필요하고,
    //   여기서 보정까지 장전하면 자동 invoke가 3회가 된다(상한 2 위반, qa-logic L1).
    //   하이드레이션(getSession+AsyncStorage)이 프리워밍된 WebView의 READY보다 느리면 실제로 이 순서가 된다.
    //   실측 뷰포트는 추정보다 항상 정확하므로 늦게 깨어난 선로딩은 그냥 버린다.
    if (firstLoadUsedRef.current) return;
    const span = spanRef.current;
    const respanned = span
      ? nearbyPreloadBbox({ coords: centerOf({ bounds: bbox }), pins: [], span })
      : null;
    const target = respanned ?? bbox;
    preloadBboxRef.current = target;
    correctionArmedRef.current = true;
    startQuery({ bbox: target, trigger: NearbyInvokeTrigger.Preload, defer: true });
  };

  const preload = ({ bbox }: { bbox: Bounds }): void => {
    if (preloadCalledRef.current) return; // 마운트당 1회(좌표가 warm→fresh로 승격돼도 재발사 0).
    preloadCalledRef.current = true;
    // 하이드레이션보다 먼저 오면 큐잉한다 — 순서가 뒤집히면 캐시 히트를 놓치고 invoke가 샌다(A3-2).
    if (!hydratedRef.current) {
      pendingPreloadRef.current = bbox;
      return;
    }
    runPreload({ bbox });
  };

  const research = (): void => {
    const bbox = currentBoundsRef.current;
    if (!bbox) return; // 뷰포트 미수신 — 누를 수 없는 상태(버튼도 안 뜬다).
    startQuery({ bbox, trigger: NearbyInvokeTrigger.Research, defer: false });
  };

  const setBounds = (next: Bounds): void => {
    currentBoundsRef.current = next;
    setCurrentBounds(next);
    recordSpanOnce({ bounds: next });

    // 허용분 미소진(선로딩 스킵/미도착) → 여기서 첫 조회를 발사한다(0틱).
    if (!firstLoadUsedRef.current) {
      startQuery({ bbox: next, trigger: NearbyInvokeTrigger.FirstBounds, defer: true });
      return;
    }
    // 아직 0틱 조회가 발사되기 전이면 대상 bbox만 최신으로 재타겟한다 — idle 다발이 마지막 1건으로 수렴(C9·T2).
    if (queryTimerRef.current !== null) {
      startQuery({ bbox: next, trigger: queryTriggerRef.current, defer: true });
      return;
    }
    // 선로딩 bbox와 첫 실제 뷰포트가 임계 초과로 어긋났으면 1회만 보정한다.
    //   사용자 팬이 아니라 "첫 화면"이 아직 확정되지 않은 상태이므로 버튼을 띄우지 않고 자동으로 맞춘다.
    const armed = correctionArmedRef.current;
    correctionArmedRef.current = false;
    const preloaded = preloadBboxRef.current;
    if (armed && preloaded && exceedsResearchThreshold({ prev: preloaded, next })) {
      startQuery({ bbox: next, trigger: NearbyInvokeTrigger.Correction, defer: true });
      return;
    }
    // 그 외에는 아무 일도 하지 않는다 — 이 신호는 "현재 뷰포트는 여기다"라는 통지일 뿐이다(§4.0).
  };

  useEffect(function hydrateNearbyCacheOnMount() {
    mountedRef.current = true;
    // 순차 실행: 세션 → 캐시 로드 → (있으면) 즉시 표시 → 그 다음에야 대기 중 선로딩을 실행한다.
    const hydrate = async () => {
      let userId = '';
      try {
        const { data } = await supabase.auth.getSession();
        userId = data?.session?.user?.id ?? '';
      } catch {
        userId = ''; // 세션 실패 → 캐시 미접촉(no-op). 조회 자체는 그대로 진행된다.
      }
      if (!mountedRef.current) return;
      userIdRef.current = userId;

      const cached = userId ? await loadNearbyCache({ userId }) : null;
      if (!mountedRef.current) return;
      if (cached) {
        if (cached.span) spanRef.current = cached.span;
        cached.areas.forEach((area) => areasRef.current.set(area.key, area));
        const hydratedItems = foldAreas();
        traceNearby({
          event: NearbyTraceEvent.CacheHydrate,
          detail: {
            areas: cached.areas.length,
            items: hydratedItems.length,
            ageMs: Date.now() - cached.savedAt,
          },
        });
        if (hydratedItems.length > 0) {
          setItems(hydratedItems);
          setStatus('ready');
        }
      }
      hydratedRef.current = true;

      const pending = pendingPreloadRef.current;
      pendingPreloadRef.current = null;
      if (pending) runPreload({ bbox: pending });
    };
    void hydrate();

    return function cleanupNearbyPlaces() {
      mountedRef.current = false;
      clearQueryTimer(); // 유령 invoke 0(E8).
      if (writeTimerRef.current) {
        // 대기 중 캐시 쓰기는 취소가 아니라 flush — 방금 받은 핀을 다음 진입이 잃지 않게(A3-13).
        clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
        persistCache();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 1회 하이드레이션(폴링 방지). 내부 헬퍼는 최신 ref만 읽는다.
  }, []);

  // 버튼 노출(map-feedback U4로 갱신): 공통 전제 2 + 택 1.
  //   공통 전제 — 조회 중 아님 · 뷰포트 수신함. currentBounds를 AND 밖에 두는 이유: research()가
  //     currentBoundsRef null이면 no-op이라, 빠지면 "눌러도 아무 일도 안 하는 버튼"이 된다.
  //   택 1 — ① status==='error'(실패 복구 경로: 이 마운트에서 적용된 area가 아직 없을 수도 있으므로
  //     lastQueried를 요구하지 않는다. 첫 조회가 실패하면 lastQueried가 영원히 null이라 기존 식으로는
  //     그 세션에서 주변 핀을 볼 방법이 사라졌다) ② 기준선 대비 임계 초과(정상 드리프트 경로).
  //   자기치유는 그대로다: research() 성공 → status='ready' + lastQueried=현재 bbox → drift 0 → 버튼이 스스로 숨는다.
  //   실패 후에는 미세 이동에도 버튼이 남는다(에러 경로는 임계를 보지 않는다) — 그게 복구 어포던스다.
  const researchAvailable =
    status !== 'loading' &&
    currentBounds !== null &&
    (status === 'error' ||
      (lastQueried !== null &&
        exceedsResearchThreshold({ prev: lastQueried.bounds, next: currentBounds })));

  // 마커는 items에서 파생(지도 핀용 kind:'nearby'). 직접 계산(useMemo 지양, 컨벤션).
  const markers = nearbyToMapMarkers({ items });

  return { markers, items, status, setBounds, preload, research, researchAvailable };
};
