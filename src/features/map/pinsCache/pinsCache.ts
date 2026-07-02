// src/features/map/pinsCache/pinsCache.ts
// 먹로그 핀 로컬 캐시 — userId 네임스페이싱·버전 태깅 (map-pins-cache plan §3.2).
//
// 생산자/소비자: useMuklogPins(읽기=진입 시 즉시표시, 쓰기=RPC 재검증 성공 시 갱신).
// 보안: 반드시 userId로 키잉 — 계정 전환 시 타 계정 캐시 미노출(§6 격리). userId 미확보면 read/write no-op.
// 저장소: AsyncStorage(프로젝트 표준, 신규 네이티브 모듈 0 — plan §3.1). 네트워크 0(로컬 I/O).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type MuklogPin } from '../types';

/** 캐시 스키마 버전 — MuklogPin 형 변경 시 bump하면 구 캐시가 자동 miss(폴백)된다. */
export const PINS_CACHE_VERSION = 1;

/** 영속 페이로드 형(버전 포함) — save/load 왕복 계약의 단일 출처. */
type PinsCachePayload = { version: number; pins: MuklogPin[] };

/**
 * 캐시 저장 키를 만든다 — userId 네임스페이싱이 계정 격리의 핵심.
 * @param userId 현재 사용자 id
 * @returns `muklog:map-pins:v{버전}:{userId}` 형식의 키
 */
export const pinsCacheKey = ({ userId }: { userId: string }): string =>
  `muklog:map-pins:v${PINS_CACHE_VERSION}:${userId}`;

/**
 * 캐시된 핀 1건이 최소형({ muklogId:string, lat:number, lng:number })을 만족하는지 검증한다.
 * @param value JSON.parse로 복원한 임의 값
 * @returns 최소형 충족 여부
 */
const isValidCachedPin = ({ value }: { value: unknown }): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const pin = value as Record<string, unknown>;
  return (
    typeof pin.muklogId === 'string' &&
    typeof pin.lat === 'number' &&
    typeof pin.lng === 'number'
  );
};

/**
 * 로컬 캐시에서 핀 목록을 읽는다 — 어떤 실패도 조용히 null(miss)로 폴백해 절대 throw하지 않는다.
 *   키 없음/파싱 실패/버전 불일치/형 불량 전부 null. userId 미확보면 읽지 않는다(no-op).
 * @param userId 현재 사용자 id(빈 문자열이면 no-op → null)
 * @returns 유효한 MuklogPin[] 또는 null(miss — 호출부는 RPC로 폴백)
 */
export const loadCachedPins = async ({
  userId,
}: {
  userId: string;
}): Promise<MuklogPin[] | null> => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(pinsCacheKey({ userId }));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PinsCachePayload> | null;
    if (parsed === null || parsed.version !== PINS_CACHE_VERSION) return null;
    if (!Array.isArray(parsed.pins)) return null;
    if (!parsed.pins.every((pin) => isValidCachedPin({ value: pin }))) return null;
    return parsed.pins as MuklogPin[];
  } catch {
    return null;
  }
};

/**
 * RPC 재검증 성공 후 최신 핀으로 캐시를 갱신한다(버전 태깅). best-effort — 쓰기 실패는 흡수한다.
 *   userId 미확보면 쓰지 않는다(no-op — 잘못된 키로 계정 오염 금지).
 * @param userId 현재 사용자 id(빈 문자열이면 no-op)
 * @param pins 저장할 최신 핀 목록
 */
export const saveCachedPins = async ({
  userId,
  pins,
}: {
  userId: string;
  pins: MuklogPin[];
}): Promise<void> => {
  if (!userId) return;
  try {
    const payload: PinsCachePayload = { version: PINS_CACHE_VERSION, pins };
    await AsyncStorage.setItem(pinsCacheKey({ userId }), JSON.stringify(payload));
  } catch {
    // best-effort 로컬 쓰기 — 실패해도 다음 진입에서 RPC가 재검증하므로 무해(§6 자가 치유).
  }
};
