// src/features/map/nearbyCache/nearbyCache.ts
// 주변(nearby) 핀 로컬 캐시 — userId 네임스페이싱·버전 태깅·TTL 부분 폐기 (map-pin-loading plan §4.3).
//
// 생산자/소비자: useNearbyPlaces(읽기=마운트 하이드레이션으로 즉시 표시, 쓰기=조회 성공 후 디바운스 flush).
// 보안: 반드시 userId로 키잉 — 계정 전환 시 타 계정 주변 핀 미노출(E5). userId 미확보면 read/write no-op.
//   pinsCache(`muklog:map-pins:v1:{userId}`)와 **네임스페이스를 분리**해 서로의 값을 덮지 않는다(B3).
// 저장소: AsyncStorage(프로젝트 표준, 신규 네이티브 모듈 0). 네트워크 0(로컬 I/O), 상한 ≈24KB(area 8 × 15건).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type BboxSpan, type Bounds } from '../bboxDrift';
import { type NearbyPlaceItem } from '../types';

/** 캐시 스키마 버전 — payload 형 변경 시 bump하면 구 캐시가 자동 miss(폴백)된다. */
export const NEARBY_CACHE_VERSION = 1;

/** 신선도 상한(24h) — 가게 폐업·신규를 하루 안에 반영. 만료 시 areas만 폐기하고 span은 보존한다. */
export const NEARBY_CACHE_TTL_MS = 86_400_000;
/** 보관 area 상한 — 8 areas × 15건 × ≈200B ≈ 24KB. 초과 시 LRU로 가장 오래된 area부터 퇴출. */
export const NEARBY_CACHE_AREA_CAP = 8;
/** 쓰기 디바운스(ms) — 연속 조회를 1회 쓰기로 수렴. 언마운트 시 대기 중 쓰기는 flush(취소 아님). */
export const NEARBY_CACHE_WRITE_DEBOUNCE_MS = 2000;

/** 캐시된 area 1건 — 그 뷰포트의 **원본 응답**(누적본이 아님, 하이드레이션에서 다시 누적한다). */
export type NearbyCacheArea = {
  key: string; // 양자화 bbox 키(소수 4자리)
  bounds: Bounds;
  items: NearbyPlaceItem[];
};

/** 영속 페이로드 형(버전·시각 포함) — save/load 왕복 계약의 단일 출처. */
export type NearbyCachePayload = {
  version: number;
  savedAt: number; // Date.now() — TTL 판정
  span: BboxSpan | null; // 세션 첫 BOUNDS_CHANGED에서 관측한 level 5 span
  areas: NearbyCacheArea[]; // LRU 순(오래된 것 → 최근)
};

/**
 * 캐시 저장 키를 만든다 — userId 네임스페이싱이 계정 격리의 핵심.
 * @param userId 현재 사용자 id
 * @returns `muklog:map-nearby:v{버전}:{userId}` 형식의 키
 */
export const nearbyCacheKey = ({ userId }: { userId: string }): string =>
  `muklog:map-nearby:v${NEARBY_CACHE_VERSION}:${userId}`;

/** 유한수 여부(문자열 '37.5' 같은 느슨한 값을 거른다). */
const isFiniteNumber = ({ value }: { value: unknown }): boolean =>
  typeof value === 'number' && Number.isFinite(value);

/** 좌표 1쌍이 유한수 lat/lng를 갖는지. */
const isValidCoords = ({ value }: { value: unknown }): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const coords = value as Record<string, unknown>;
  return isFiniteNumber({ value: coords.lat }) && isFiniteNumber({ value: coords.lng });
};

/** 캐시된 nearby 항목 1건이 최소형({ kakaoPlaceId, lat, lng })을 만족하는지. */
const isValidCachedItem = ({ value }: { value: unknown }): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.kakaoPlaceId === 'string' &&
    isFiniteNumber({ value: item.lat }) &&
    isFiniteNumber({ value: item.lng })
  );
};

/** 캐시된 area 1건의 최소형({ key, bounds{sw,ne}, items[] }) 검증. 하나라도 어긋나면 전체 miss. */
const isValidCachedArea = ({ value }: { value: unknown }): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const area = value as Record<string, unknown>;
  if (typeof area.key !== 'string') return false;
  if (typeof area.bounds !== 'object' || area.bounds === null) return false;
  const bounds = area.bounds as Record<string, unknown>;
  if (!isValidCoords({ value: bounds.sw }) || !isValidCoords({ value: bounds.ne })) return false;
  if (!Array.isArray(area.items)) return false;
  return area.items.every((item) => isValidCachedItem({ value: item }));
};

/** span은 있으면 좋고 없어도 되는 값 — 형이 어긋나면 전체를 버리지 않고 null로 떨군다. */
const normalizeSpan = ({ value }: { value: unknown }): BboxSpan | null => {
  if (typeof value !== 'object' || value === null) return null;
  const span = value as Record<string, unknown>;
  if (!isFiniteNumber({ value: span.lat }) || !isFiniteNumber({ value: span.lng })) return null;
  return { lat: span.lat as number, lng: span.lng as number };
};

/**
 * 로컬 캐시에서 주변 핀 payload를 읽는다 — 어떤 실패도 조용히 null(miss)로 폴백해 절대 throw하지 않는다.
 *   TTL 초과는 miss가 아니라 **부분 폐기**다(areas=[] · span 유지) — span은 기기·줌의 성질이라
 *   시간에 부패하지 않고, 버리면 다음 진입의 선로딩 정확도만 떨어진다.
 * @param userId 현재 사용자 id(빈 문자열이면 no-op → null)
 * @returns 유효한 payload 또는 null(miss)
 */
export const loadNearbyCache = async ({
  userId,
}: {
  userId: string;
}): Promise<NearbyCachePayload | null> => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(nearbyCacheKey({ userId }));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (parsed === null || typeof parsed !== 'object') return null;
    if (parsed.version !== NEARBY_CACHE_VERSION) return null;
    if (!isFiniteNumber({ value: parsed.savedAt })) return null;
    if (!Array.isArray(parsed.areas)) return null;
    if (!parsed.areas.every((area) => isValidCachedArea({ value: area }))) return null;

    const savedAt = parsed.savedAt as number;
    const span = normalizeSpan({ value: parsed.span });
    // 미래 시각(시계 조작)은 만료로 보지 않는다 — 방어적으로 유효 취급(E18).
    const expired = Date.now() - savedAt > NEARBY_CACHE_TTL_MS;
    return {
      version: NEARBY_CACHE_VERSION,
      savedAt,
      span,
      areas: expired ? [] : (parsed.areas as NearbyCacheArea[]),
    };
  } catch {
    return null;
  }
};

/**
 * 주변 핀 payload를 로컬에 저장한다(버전 태깅 + area cap 적용). best-effort — 쓰기 실패는 흡수한다.
 *   userId 미확보면 쓰지 않는다(no-op — 잘못된 키로 계정 오염 금지).
 * @param userId 현재 사용자 id(빈 문자열이면 no-op)
 * @param payload 저장할 payload(areas는 LRU 순: 오래된 것 → 최근)
 */
export const saveNearbyCache = async ({
  userId,
  payload,
}: {
  userId: string;
  payload: NearbyCachePayload;
}): Promise<void> => {
  if (!userId) return;
  try {
    // cap은 쓰기 시점에 강제한다 — 호출부가 어떻게 쌓든 저장 규모 상한(≈24KB)이 지켜지게.
    const areas = payload.areas.slice(-NEARBY_CACHE_AREA_CAP);
    const next: NearbyCachePayload = { ...payload, version: NEARBY_CACHE_VERSION, areas };
    await AsyncStorage.setItem(nearbyCacheKey({ userId }), JSON.stringify(next));
  } catch {
    // best-effort 로컬 쓰기 — 실패해도 다음 진입에서 조회가 재검증하므로 무해(자가 치유).
  }
};
