// src/features/muklog/errors.ts
// 먹로그 트리거/검증 에러 토큰 → 사용자용 한국어 메시지 매핑 (plan §5.3 / §5 T4, AC3·AC4·AC5·AC11).
//
// 생산자: 마이그레이션 enforce_muklog_fields() 트리거가 `raise exception '<TOKEN>'` → Supabase JS error.message에 토큰.
//   + useCreateMuklog의 앱단 1차 검증(normalizeMuklogInput)이 동일 토큰을 throw.
// 소비자: useCreateMuklog / MuklogEntrySheet 가 이 유틸로 인라인 에러 메시지를 만든다.
// ⚠️ 토큰 문자열은 SQL(트리거 raise) ↔ validate.ts ↔ 이 매핑이 단일 출처여야 한다. 추가/변경 시 동기화.

/** 트리거/검증이 발생시키는 에러 토큰(enum-style 단일 출처). */
export const MuklogErrorToken = {
  PlaceNameRequired: 'PLACE_NAME_REQUIRED',
  RatingOutOfRange: 'RATING_OUT_OF_RANGE',
  VisitedAtInFuture: 'VISITED_AT_IN_FUTURE',
  // 사진 슬라이스(muklog-photos) — 트리거(enforce_muklog_photo_fields)·권한·업로드.
  PhotoOrderOutOfRange: 'PHOTO_ORDER_OUT_OF_RANGE', // 트리거: order_index 0~4 범위 밖
  PhotoLimitExceeded: 'PHOTO_LIMIT_EXCEEDED', // 트리거: 먹로그당 5장 초과
  PermissionDenied: 'PERMISSION_DENIED', // 갤러리 권한 거부(공통)
  PhotoUploadFailed: 'PHOTO_UPLOAD_FAILED', // Storage 업로드/처리 실패
  // 장소검색 슬라이스(muklog-place) — Edge Function(place-search) 응답 토큰 + 클라 네트워크 폴백(plan §3.6).
  //   ⚠️ KAKAO_KEY_MISSING/KAKAO_REQUEST_FAILED/QUERY_REQUIRED는 Edge Function이 body { error: <TOKEN> }로 반환(plan §3.2),
  //   PLACE_SEARCH_FAILED는 searchPlaces가 네트워크 등 기타 실패를 정규화. 모든 검색 실패는 수동입력 폴백을 막지 않는다.
  QueryRequired: 'QUERY_REQUIRED', // Edge: query 누락/공백(400) — UI 비노출 방어
  KakaoKeyMissing: 'KAKAO_KEY_MISSING', // Edge: 서버 REST 키 미설정(500)
  KakaoRequestFailed: 'KAKAO_REQUEST_FAILED', // Edge: Kakao API 비정상/타임아웃(502)
  PlaceSearchFailed: 'PLACE_SEARCH_FAILED', // 클라: 네트워크 등 기타 검색 실패
} as const;
export type MuklogErrorToken = (typeof MuklogErrorToken)[keyof typeof MuklogErrorToken];

/** 에러 토큰 → 한국어 메시지. */
export const MUKLOG_ERROR_MESSAGES: Record<string, string> = {
  [MuklogErrorToken.PlaceNameRequired]: '장소 이름을 입력해 주세요.',
  [MuklogErrorToken.RatingOutOfRange]: '별점은 1~5 사이로 선택해 주세요.',
  [MuklogErrorToken.VisitedAtInFuture]: '방문일은 오늘까지만 선택할 수 있어요.',
  [MuklogErrorToken.PhotoOrderOutOfRange]: '사진은 최대 5장까지 첨부할 수 있어요.',
  [MuklogErrorToken.PhotoLimitExceeded]: '사진은 최대 5장까지 첨부할 수 있어요.',
  [MuklogErrorToken.PermissionDenied]: '사진 접근 권한이 필요해요. 설정에서 허용해 주세요.',
  [MuklogErrorToken.PhotoUploadFailed]: '사진 업로드에 실패했어요. 다시 시도해 주세요.',
  // 장소검색 — 실패해도 수동입력 폴백을 막지 않는 안내 문구(plan §3.6).
  [MuklogErrorToken.QueryRequired]: '검색어를 입력해 주세요.',
  [MuklogErrorToken.KakaoKeyMissing]: '장소 검색을 사용할 수 없어요. 직접 입력해 주세요.',
  [MuklogErrorToken.KakaoRequestFailed]:
    '장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.',
  [MuklogErrorToken.PlaceSearchFailed]:
    '장소 검색에 실패했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.',
};

/** 토큰 미일치(네트워크/그 외) 시 기본 메시지. */
export const DEFAULT_MUKLOG_ERROR_MESSAGE = '저장에 실패했어요. 다시 시도해 주세요.';

/**
 * 알 수 없는 에러 값에서 메시지 문자열을 안전하게 추출한다.
 * @param error 임의 타입의 에러 값(Error | string | { message } | 기타)
 * @returns 추출된 메시지 문자열(없으면 빈 문자열)
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
 * 에러 객체에서 먹로그 토큰을 찾아 한국어 메시지로 매핑한다.
 * 1) 메시지 == 토큰 정확 일치  2) 메시지에 토큰 포함  3) 기본 메시지.
 * @param error 트리거/검증/네트워크에서 발생한 에러 값
 * @returns 사용자에게 보여줄 한국어 메시지
 */
export const mapMuklogError = ({ error }: { error: unknown }): string => {
  const message = extractMessage({ error });

  if (message in MUKLOG_ERROR_MESSAGES) return MUKLOG_ERROR_MESSAGES[message];

  for (const token of Object.keys(MUKLOG_ERROR_MESSAGES)) {
    if (message.includes(token)) return MUKLOG_ERROR_MESSAGES[token];
  }

  return DEFAULT_MUKLOG_ERROR_MESSAGE;
};
