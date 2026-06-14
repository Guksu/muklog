// src/features/muklog/searchPlaces.ts
// place-search Edge Function invoke 래퍼 (plan §3.5·§3.6, 경계면 §7-1·§7-2).
//   생산자: place-search Edge Function이 { results: PlaceSearchItem[] }(camelCase) 또는 { error: <TOKEN> } 반환.
//   소비자: usePlaceSearch가 디바운스/캐싱 후 호출. 에러는 errors.ts 토큰으로 정규화해 throw(매핑은 mapMuklogError).
//   모든 실패는 수동입력 폴백을 막지 않는다(usePlaceSearch가 status='error'로만 표시).
import { supabase } from '@/lib/supabase';

import { MuklogErrorToken } from './errors';
import { type PlaceSearchItem } from './types';

// searchPlaces가 식별하는 검색 실패 토큰(나머지는 PLACE_SEARCH_FAILED로 흡수).
const PLACE_SEARCH_TOKENS: string[] = [
  MuklogErrorToken.QueryRequired,
  MuklogErrorToken.KakaoKeyMissing,
  MuklogErrorToken.KakaoRequestFailed,
  MuklogErrorToken.PlaceSearchFailed,
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
 * 문자열에서 알려진 검색 토큰을 찾는다(정확/포함 매칭).
 * @param value 메시지/토큰 문자열
 * @returns 매칭 토큰 또는 null
 */
const tokenFromText = ({ value }: { value: string }): string | null => {
  for (const token of PLACE_SEARCH_TOKENS) {
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
      // best-effort: 본문 파싱 실패는 무시(PLACE_SEARCH_FAILED로 흡수).
    }
  }
  return null;
};

/**
 * place-search Edge Function을 호출해 정규화된 검색 결과를 반환한다.
 * 실패는 errors.ts 토큰으로 정규화해 throw(식별 불가 → PLACE_SEARCH_FAILED).
 * @param query 검색 키워드(usePlaceSearch가 trim/min 글자수 가드 후 전달)
 * @returns PlaceSearchItem 배열(0건이면 [])
 */
export const searchPlaces = async ({ query }: { query: string }): Promise<PlaceSearchItem[]> => {
  let result: { data: unknown; error: unknown };
  try {
    result = await supabase.functions.invoke('place-search', { body: { query } });
  } catch {
    throw new Error(MuklogErrorToken.PlaceSearchFailed); // 네트워크 reject 등.
  }

  if (result.error) {
    const token = await tokenFromInvokeError({ error: result.error });
    throw new Error(token ?? MuklogErrorToken.PlaceSearchFailed);
  }

  const body = (result.data ?? {}) as { results?: PlaceSearchItem[]; error?: string };
  if (typeof body.error === 'string') {
    throw new Error(tokenFromText({ value: body.error }) ?? MuklogErrorToken.PlaceSearchFailed);
  }
  return body.results ?? [];
};
