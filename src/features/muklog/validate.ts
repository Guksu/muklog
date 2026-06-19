// src/features/muklog/validate.ts
// 먹로그 입력 정규화/검증(앱단 1차 방어) + snake row 빌더 (plan §5.3 / §5 T3, AC3·AC4·AC5).
//   앱단에서 대부분 차단하고, DB 트리거(enforce_muklog_fields)가 최종 방어한다(토큰 단일 출처: errors.ts).
//   미래 방문일 비교는 로컬 날짜(todayLocalDate) 기준 — DB의 current_date(서버 TZ)와 미세 차이 가능하나
//   앱 1차는 사용자 로컬 기준이 자연스럽고, 경계 케이스는 트리거가 최종 방어한다.
import { MuklogErrorToken } from './errors';
import { type CreateMuklogInput, type NormalizedMuklogInput } from './types';

/** 메모 최소 길이(필수 입력, 사용자 요청). 에디터 저장 게이팅·검증의 단일 출처. */
export const MEMO_MIN_LENGTH = 5;

/**
 * 오늘 날짜를 로컬 기준 'YYYY-MM-DD'로 반환한다(타임존 시프트 없이 표시·비교용).
 * @returns 'YYYY-MM-DD'
 */
export const todayLocalDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 빈/공백 문자열을 null로, 그 외는 trim 결과로 정규화한다(데이터 결측 단일 처리).
 * @param value 원본 문자열(또는 null/undefined)
 * @returns trim된 문자열 또는 null
 */
const trimToNull = ({ value }: { value: string | null | undefined }): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * 좌표 number를 유한값만 통과시킨다(null/undefined/NaN/Infinity → null). place 좌표 정규화용(plan §3.8).
 * @param value 좌표 number(또는 null/undefined)
 * @returns 유한 number 또는 null
 */
const finiteCoord = ({ value }: { value: number | null | undefined }): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

/**
 * 입력을 정규화하고 1차 검증한다(장소명 필수·rating 1~5·미래 방문일 차단). 위반 시 토큰을 throw.
 * @param input 입력 시트가 만든 원본 입력
 * @returns 정규화된 입력(row 빌더 입력)
 */
export const normalizeMuklogInput = ({
  input,
}: {
  input: CreateMuklogInput;
}): NormalizedMuklogInput => {
  const placeName = (input.placeName ?? '').trim();
  if (placeName.length === 0) {
    throw new Error(MuklogErrorToken.PlaceNameRequired);
  }

  // rating: 0/null/undefined = 미평가(null). 그 외는 1~5만 허용.
  let rating: number | null = null;
  if (input.rating != null && input.rating !== 0) {
    if (input.rating < 1 || input.rating > 5) {
      throw new Error(MuklogErrorToken.RatingOutOfRange);
    }
    rating = input.rating;
  }

  const visitedAt = input.visitedAt ?? todayLocalDate();
  if (visitedAt > todayLocalDate()) {
    throw new Error(MuklogErrorToken.VisitedAtInFuture);
  }

  // 메모 필수·최소 5자(사용자 요청). 빈/공백/5자 미만이면 거부(클라 1차 — DB 트리거는 레거시 행 보호 위해 미강제).
  const memo = (input.memo ?? '').trim();
  if (memo.length < MEMO_MIN_LENGTH) {
    throw new Error(MuklogErrorToken.MemoTooShort);
  }

  // place 좌표(muklog-place, plan §3.8): 유한 number만 통과. 한쪽이라도 결측/NaN이면 쌍 무결성 위해 둘 다 null
  //   (지도 map-tab가 lat is not null만 핀 → 반쪽 좌표 차단). 좌표 쌍은 placeFieldsFromItem이 이미 보장하나 2차 방어.
  const latRaw = finiteCoord({ value: input.lat });
  const lngRaw = finiteCoord({ value: input.lng });
  const hasCoordPair = latRaw !== null && lngRaw !== null;

  return {
    roomId: input.roomId,
    placeName,
    category: trimToNull({ value: input.category }),
    area: trimToNull({ value: input.area }),
    rating,
    memo,
    visitedAt,
    kakaoPlaceId: trimToNull({ value: input.kakaoPlaceId }),
    address: trimToNull({ value: input.address }),
    roadAddress: trimToNull({ value: input.roadAddress }),
    lat: hasCoordPair ? latRaw : null,
    lng: hasCoordPair ? lngRaw : null,
  };
};

/** insert 대상 snake_case row(매핑 경계 단일 출처). created_by는 RLS with check와 정합.
 *  place 필드(muklog-place §3.7·§7-4): kakao_place_id/address/road_address/lat/lng — 좌표 nullable. */
export type MuklogInsertRow = {
  room_id: string;
  place_name: string;
  category: string | null;
  area: string | null;
  memo: string | null;
  rating: number | null;
  visited_at: string;
  created_by: string;
  kakao_place_id: string | null;
  address: string | null;
  road_address: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * 정규화 입력 + 인증 userId로 insert용 snake row를 만든다(created_by 포함).
 * @param input 정규화된 입력
 * @param userId 인증된 사용자 id(created_by → RLS with check가 auth.uid()와 일치 강제)
 * @returns insert용 snake_case row
 */
export const toMuklogRow = ({
  input,
  userId,
}: {
  input: NormalizedMuklogInput;
  userId: string;
}): MuklogInsertRow => ({
  room_id: input.roomId,
  place_name: input.placeName,
  category: input.category,
  area: input.area,
  memo: input.memo,
  rating: input.rating,
  visited_at: input.visitedAt,
  created_by: userId,
  kakao_place_id: input.kakaoPlaceId,
  address: input.address,
  road_address: input.roadAddress,
  lat: input.lat,
  lng: input.lng,
});
