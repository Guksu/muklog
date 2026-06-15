// src/features/map/searchNearby.ts
// nearby-search Edge Function invoke 래퍼 (plan §3.2·§3.5, 경계면 §7). searchPlaces 미러.
//   생산자: nearby-search Edge가 { results: NearbyPlaceItem[] }(camelCase) 또는 { error: <TOKEN> } 반환.
//   소비자: useNearbyPlaces가 디바운스/캐시/임계 후 호출. 실패는 errors.ts 토큰으로 정규화해 throw.
//   nearby 실패는 차단 아님 — useNearbyPlaces가 status='error'로만 표시(지도/saved 핀/카드 불변).
import { MuklogErrorToken } from '@/features/muklog/errors';
import { supabase } from '@/lib/supabase';

import { type Coords, type NearbyPlaceItem } from './types';

// searchNearby가 식별하는 실패 토큰(나머지는 NEARBY_SEARCH_FAILED로 흡수).
const NEARBY_SEARCH_TOKENS: string[] = [
  MuklogErrorToken.BoundsRequired,
  MuklogErrorToken.KakaoKeyMissing,
  MuklogErrorToken.KakaoRequestFailed,
  MuklogErrorToken.NearbySearchFailed,
];

/**
 * 임의 에러 값에서 메시지 문자열을 안전 추출한다.
 * @param error 임의 타입 에러
 * @returns 메시지(없으면 '')
 */
const extractMessage = ({ error }: { error: unknown }): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
};

/**
 * 문자열에서 알려진 nearby 토큰을 찾는다(포함 매칭).
 * @param value 메시지/토큰 문자열
 * @returns 매칭 토큰 또는 null
 */
const tokenFromText = ({ value }: { value: string }): string | null => {
  for (const token of NEARBY_SEARCH_TOKENS) {
    if (value.includes(token)) return token;
  }
  return null;
};

/**
 * invoke가 돌려준 error(FunctionsHttpError 등)에서 토큰을 추출한다.
 * 1) 메시지 포함 매칭  2) context Response 본문 { error: <TOKEN> } 파싱(best-effort).
 * @param error invoke 결과의 error 값
 * @returns 식별된 토큰 또는 null
 */
const tokenFromInvokeError = async ({ error }: { error: unknown }): Promise<string | null> => {
  const direct = tokenFromText({ value: extractMessage({ error }) });
  if (direct) return direct;
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (context?.json) {
    try {
      const body = (await context.json()) as { error?: unknown };
      if (typeof body?.error === 'string') return tokenFromText({ value: body.error });
    } catch {
      // best-effort: 본문 파싱 실패는 무시(NEARBY_SEARCH_FAILED로 흡수).
    }
  }
  return null;
};

/**
 * nearby-search Edge Function을 호출해 정규화된 주변 음식점 결과를 반환한다.
 * 실패는 errors.ts 토큰으로 정규화해 throw(식별 불가 → NEARBY_SEARCH_FAILED).
 * @param sw 남서(min) 코너 좌표(useNearbyPlaces가 가드 후 전달)
 * @param ne 북동(max) 코너 좌표
 * @returns NearbyPlaceItem 배열(0건이면 [])
 */
export const searchNearby = async ({
  sw,
  ne,
}: {
  sw: Coords;
  ne: Coords;
}): Promise<NearbyPlaceItem[]> => {
  let result: { data: unknown; error: unknown };
  try {
    result = await supabase.functions.invoke('nearby-search', { body: { sw, ne } });
  } catch {
    throw new Error(MuklogErrorToken.NearbySearchFailed); // 네트워크 reject 등.
  }

  if (result.error) {
    const token = await tokenFromInvokeError({ error: result.error });
    throw new Error(token ?? MuklogErrorToken.NearbySearchFailed);
  }

  const body = (result.data ?? {}) as { results?: NearbyPlaceItem[]; error?: string };
  if (typeof body.error === 'string') {
    throw new Error(tokenFromText({ value: body.error }) ?? MuklogErrorToken.NearbySearchFailed);
  }
  return body.results ?? [];
};
