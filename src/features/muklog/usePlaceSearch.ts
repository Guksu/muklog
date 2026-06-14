// src/features/muklog/usePlaceSearch.ts
// 장소검색 훅 — 디바운스 + 인메모리 캐싱 + min 글자수 + 레이스 가드 (plan §3.5·§6, 비용 가드레일 §8).
//   생산자: searchPlaces(place-search Edge Function invoke 래퍼).
//   소비자: MuklogEntrySheet 장소검색 영역(검색 입력 → 결과 리스트). 실패는 status='error'로만 표시(수동입력 폴백 유지).
//   비용: 350ms 디바운스로 타이핑 중 과호출 차단 + 동일 쿼리 캐시로 재호출 0 + min 2글자로 광역 검색 차단.
import { useEffect, useRef, useState } from 'react';

import { mapMuklogError } from './errors';
import { searchPlaces } from './searchPlaces';
import { type PlaceSearchItem, type PlaceSearchStatus } from './types';

/** 디바운스 지연(ms) — 타이핑 멈춘 뒤 1회 호출(비용 가드레일). */
export const PLACE_SEARCH_DEBOUNCE_MS = 350;
/** 최소 검색 글자수(trim 기준) — 미만이면 미호출(광역 검색 차단). */
export const PLACE_SEARCH_MIN_LENGTH = 2;

export type UsePlaceSearchResult = {
  query: string;
  setQuery: (next: string) => void;
  results: PlaceSearchItem[];
  status: PlaceSearchStatus;
  errorMessage: string | null;
};

/**
 * 장소 키워드 검색 상태를 제공하는 훅. setQuery로 입력하면 디바운스 후 1회 검색하고,
 * 동일 쿼리는 캐시로 재호출하지 않으며, 늦게 온 stale 응답은 폐기한다.
 * @returns query/setQuery + results/status/errorMessage
 */
export const usePlaceSearch = (): UsePlaceSearchResult => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchItem[]>([]);
  const [status, setStatus] = useState<PlaceSearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, PlaceSearchItem[]>>(new Map());
  // 매 입력마다 증가 → in-flight/늦은 응답을 stale로 판정(레이스 가드, plan §3.5).
  const requestSeqRef = useRef(0);

  useEffect(
    function debounceSearch() {
      const trimmed = query.trim();
      const normalized = trimmed.toLowerCase();
      const seq = (requestSeqRef.current += 1); // 이전 요청 무효화.

      // min 글자수 미만 → idle 복귀(직전 결과 제거). 미호출.
      if (trimmed.length < PLACE_SEARCH_MIN_LENGTH) {
        setStatus('idle');
        setResults([]);
        setErrorMessage(null);
        return;
      }

      // 캐시 히트 → invoke 미호출(비용 가드레일).
      const cached = cacheRef.current.get(normalized);
      if (cached) {
        setResults(cached);
        setStatus('ready');
        setErrorMessage(null);
        return;
      }

      const timer = setTimeout(function runSearch() {
        setStatus('loading');
        setErrorMessage(null);
        searchPlaces({ query: trimmed })
          .then(function onResults(items) {
            if (seq !== requestSeqRef.current) return; // stale 폐기.
            cacheRef.current.set(normalized, items);
            setResults(items);
            setStatus('ready');
          })
          .catch(function onError(error) {
            if (seq !== requestSeqRef.current) return; // stale 폐기.
            setResults([]);
            setStatus('error');
            setErrorMessage(mapMuklogError({ error }));
          });
      }, PLACE_SEARCH_DEBOUNCE_MS);

      return function cancelDebounce() {
        clearTimeout(timer);
      };
    },
    [query],
  );

  return { query, setQuery, results, status, errorMessage };
};
