// src/features/map/useNearbyPlaces.ts
// 주변 음식점 viewport 훅 — 디바운스 + 양자화 캐시 + 최소이동 임계 + 레이스 가드 (plan §3.5·§8 비용 가드레일).
//   생산자: searchNearby(nearby-search invoke 래퍼). 소비자: MapTabScreen(머지 후 SET_MARKERS + 카드).
//   비용 가드레일(테스트로 강제 §5-1):
//     - 디바운스 500ms: 지도 연속 이동 중 과호출 차단(idle 다발 → 1회 수렴).
//     - 양자화 bbox 캐시: 소수 4자리 키로 정규화 → 동일 영역 재방문 시 invoke 0회(인메모리 Map).
//     - 최소 이동 임계: 직전 조회 bbox와 중심 이동·폭 변화가 임계 미만이면 미호출(미세 흔들림/관성 흡수).
//     - 레이스 가드: requestSeqRef 증가 → 늦게 온 stale 응답 폐기.
//   에러는 status='error' + markers 비움(핀만 영향, 지도/saved/카드 불변 — 차단 아님).
import { useEffect, useRef, useState } from 'react';

import { boundsToRect } from './boundsToRect';
import { nearbyToMapMarkers } from './nearbyToMapMarkers';
import { searchNearby } from './searchNearby';
import {
  type Coords,
  type MapMarker,
  type NearbyPlaceItem,
  type NearbyPlacesStatus,
} from './types';

/** 디바운스 지연(ms) — idle 다발/연속 이동을 1회로 수렴(타이핑보다 느린 제스처라 350보다 길게). */
export const NEARBY_DEBOUNCE_MS = 500;
/** 양자화 자리수 — 소수 4자리(≈11m) 반올림 키로 캐시 정규화. */
const NEARBY_QUANTIZE_DECIMALS = 4;
/** 최소 이동 임계(도 단위) — 직전 조회 bbox의 중심에서 이 거리 미만 이동·폭 변화는 미호출(쿼터 보호). */
export const NEARBY_MIN_MOVE = 1e-3;

type Bounds = { sw: Coords; ne: Coords };

/** bbox를 양자화 키로 정규화한다(소수 N자리 반올림 → 동일 영역 캐시 히트). */
const quantizeKey = ({ sw, ne }: Bounds): string => {
  const round = (n: number): number => {
    const factor = 10 ** NEARBY_QUANTIZE_DECIMALS;
    return Math.round(n * factor) / factor;
  };
  return `${round(sw.lat)},${round(sw.lng)},${round(ne.lat)},${round(ne.lng)}`;
};

/** bbox 중심 좌표(최소 이동 임계 비교용). */
const centerOf = ({ sw, ne }: Bounds): Coords => ({
  lat: (sw.lat + ne.lat) / 2,
  lng: (sw.lng + ne.lng) / 2,
});

/** 직전 조회 bbox 대비 중심 이동·폭 변화가 임계 미만인지(미세 이동) 판정한다. */
const isBelowMinMove = ({ prev, next }: { prev: Bounds; next: Bounds }): boolean => {
  const prevCenter = centerOf(prev);
  const nextCenter = centerOf(next);
  const movedLat = Math.abs(prevCenter.lat - nextCenter.lat);
  const movedLng = Math.abs(prevCenter.lng - nextCenter.lng);
  const prevWidth = Math.abs(prev.ne.lng - prev.sw.lng);
  const nextWidth = Math.abs(next.ne.lng - next.sw.lng);
  const widthDelta = Math.abs(prevWidth - nextWidth);
  return movedLat < NEARBY_MIN_MOVE && movedLng < NEARBY_MIN_MOVE && widthDelta < NEARBY_MIN_MOVE;
};

export type UseNearbyPlacesResult = {
  setBounds: (next: Bounds) => void;
  markers: MapMarker[]; // 지도뷰 머지·핀용(saved:false). 실패/빈 → []
  items: NearbyPlaceItem[]; // NearbySpotCard 데이터 lookup용(kakaoPlaceId로 placeName/categoryName/distance 조회). 실패/빈 → []
  status: NearbyPlacesStatus;
};

/**
 * viewport(bbox) 변경 시 주변 음식점을 디바운스·캐시·임계로 조회하는 훅.
 * BOUNDS_CHANGED 수신마다 setBounds를 호출하면 가드레일을 거쳐 nearby 마커(saved:false)를 갱신한다.
 * markers=지도 핀용, items=카드 lookup용(둘 다 동일 viewport 결과에서 파생).
 * @returns setBounds + markers/items/status
 */
export const useNearbyPlaces = (): UseNearbyPlacesResult => {
  const [bounds, setBoundsState] = useState<Bounds | null>(null);
  const [items, setItems] = useState<NearbyPlaceItem[]>([]);
  const [status, setStatus] = useState<NearbyPlacesStatus>('idle');

  const cacheRef = useRef<Map<string, NearbyPlaceItem[]>>(new Map());
  // 직전에 실제로 조회(또는 캐시 적용)한 bbox·키 — 최소 이동 임계/캐시 비교 기준.
  const lastQueriedRef = useRef<{ key: string; bounds: Bounds } | null>(null);
  // 매 조회마다 증가 → in-flight/늦은 응답을 stale로 판정(레이스 가드).
  const requestSeqRef = useRef(0);

  const setBounds = (next: Bounds): void => setBoundsState(next);

  useEffect(
    function debounceNearbyFetch() {
      if (!bounds) return;

      const key = quantizeKey(bounds);
      const last = lastQueriedRef.current;

      // 동일 양자화 키 → 이미 적용된 영역(캐시/직전과 동일). 추가 작업 0.
      if (last && last.key === key) return;

      // 캐시 히트 → invoke 미호출(비용 가드레일). 결과 즉시 반영.
      const cached = cacheRef.current.get(key);
      if (cached) {
        lastQueriedRef.current = { key, bounds };
        setItems(cached);
        setStatus('ready');
        return;
      }

      // 최소 이동 임계 미만 → 미호출(미세 흔들림/관성 흡수). 직전 결과 유지.
      if (last && isBelowMinMove({ prev: last.bounds, next: bounds })) return;

      const seq = (requestSeqRef.current += 1); // 이전 요청 무효화.
      const timer = setTimeout(function runNearbySearch() {
        setStatus('loading');
        searchNearby(boundsToRect({ sw: bounds.sw, ne: bounds.ne }))
          .then(function onResults(nextItems) {
            if (seq !== requestSeqRef.current) return; // stale 폐기.
            cacheRef.current.set(key, nextItems);
            lastQueriedRef.current = { key, bounds };
            setItems(nextItems);
            setStatus('ready');
          })
          .catch(function onError() {
            if (seq !== requestSeqRef.current) return; // stale 폐기.
            setItems([]); // 핀/카드 데이터만 비움(지도/saved 불변).
            setStatus('error');
          });
      }, NEARBY_DEBOUNCE_MS);

      return function cancelDebounce() {
        clearTimeout(timer);
      };
    },
    [bounds],
  );

  // 마커는 items에서 파생(지도 핀용 saved:false). 직접 계산(useMemo 지양, 컨벤션).
  const markers = nearbyToMapMarkers({ items });

  return { setBounds, markers, items, status };
};
