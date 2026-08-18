// src/features/map/lastKnownLocation/lastKnownLocation.ts
// OS 캐시 위치(last-known) 선취득 + 프로세스 메모리 캐시 (map-initial-location plan §3.2·§8).
//
// 생산자: expo-location(비프롬프트 권한 getter + OS 캐시 위치). 저장소: 이 모듈의 모듈 변수(프로세스 수명).
// 소비자: LocationPrewarm(앱 구동 유휴 시 워밍) · useLocationPermission(첫 렌더 동기 시드 + fresh 승격/무효화).
//
// 정책(급소):
//   - 권한 프롬프트를 절대 띄우지 않는다 — getForegroundPermissionsAsync(비프롬프트 getter)로 게이트하고
//     granted가 아니면 위치 API를 "호출조차" 하지 않는다(§6 E1). request 계열은 이 파일에서 사용 금지.
//   - GPS를 깨우지 않는다 — getLastKnownPositionAsync는 OS 캐시 읽기라 배터리·네트워크 비용이 사실상 0(§8).
//   - 절대 throw하지 않는다 — 권한/위치/네이티브 미탑재 등 모든 실패는 조용히 null(호출부는 기존 폴백 유지).
//   - 디스크 영속 0 — 좌표는 메모리에만 존재하고 앱 종료 시 소멸(프라이버시, §2 out-of-scope).
import * as Location from 'expo-location';

import { type Coords } from '../types';

/** 마지막 위치 허용 나이(ms) — 이보다 오래된 OS 캐시는 무시(어제 다른 도시에서 시작하는 것 방지, E4). */
export const LAST_KNOWN_MAX_AGE_MS = 3_600_000; // 1시간
/** 최소 요구 정확도(m) — 이보다 부정확한 캐시(셀타워 수 km 등)는 무시(E5). */
export const LAST_KNOWN_REQUIRED_ACCURACY_M = 1000;

/** 프로세스 수명 메모리 캐시(디스크 영속 없음). 렌더 중 동기로 읽히는 유일한 좌표 출처. */
let warmCoords: Coords | null = null;
/** 진행 중인 워밍 Promise — 동시 호출을 1회로 접는다(E8). 완료 시 null로 되돌린다. */
let warmingPromise: Promise<Coords | null> | null = null;

/**
 * 좌표 후보를 지도에 쓸 수 있는 유한수 쌍으로 정규화한다(NaN/Infinity/누락 차단 — E6).
 * @param lat 위도 후보(임의 값)
 * @param lng 경도 후보(임의 값)
 * @returns 유한한 좌표 또는 null(이상치)
 */
const toFiniteCoords = ({ lat, lng }: { lat: unknown; lng: unknown }): Coords | null => {
  if (typeof lat !== 'number' || !Number.isFinite(lat)) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * 메모리 캐시의 좌표를 동기로 읽는다(렌더 중 호출 가능 — 훅의 lazy initializer가 첫 렌더에 시드).
 * @returns 캐시된 좌표 또는 null(미적재)
 */
export const readWarmCoords = (): Coords | null => warmCoords;

/**
 * 최신 좌표로 메모리 캐시를 갱신한다(fresh 픽스 도착 시 훅이 호출 — 다음 마운트가 정밀 좌표로 시작).
 * 이상치(NaN/Infinity)는 적재하지 않는다.
 * @param coords 저장할 좌표
 */
export const writeWarmCoords = ({ coords }: { coords: Coords }): void => {
  const next = toFiniteCoords({ lat: coords?.lat, lng: coords?.lng });
  if (!next) return;
  warmCoords = next;
};

/**
 * 메모리 캐시를 비운다(권한 거부·취소 확인 시 — 권한 없는 채로 stale 좌표를 그리지 않기 위함, E7).
 * 테스트 격리에도 사용한다.
 */
export const clearWarmCoords = (): void => {
  warmCoords = null;
};

/**
 * 권한이 이미 허용된 경우에만 OS 캐시 위치를 1회 읽어 메모리 캐시에 적재한다.
 * 권한 프롬프트를 띄우지 않으며(비프롬프트 getter 게이트), GPS도 깨우지 않는다. 어떤 실패도 throw하지 않는다.
 * @returns 적재된 좌표 또는 null(권한 없음·OS 캐시 없음·이상치·실패)
 */
const fetchLastKnownCoords = async (): Promise<Coords | null> => {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    // 비프롬프트 getter — granted가 아니면 여기서 종료(위치 API 미호출 = 프롬프트 트리거 0, E1).
    if (permission?.granted !== true) return null;
  } catch {
    // 권한 모듈 throw·네이티브 미탑재 → 조용히 포기(호출부는 기존 폴백 체인 유지).
    return null;
  }

  try {
    const position = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
    });
    // OS 캐시 없음(재설치·부팅 직후) 또는 maxAge/정확도 미달 → position이 null(E3·E4·E5).
    const next = toFiniteCoords({
      lat: position?.coords?.latitude,
      lng: position?.coords?.longitude,
    });
    if (!next) return null;
    warmCoords = next;
    return next;
  } catch {
    return null;
  }
};

/**
 * 앱 구동 유휴 시점에 OS 캐시 위치를 선취득해 메모리 캐시를 채운다(멱등·동시호출 1회화).
 * 이미 캐시가 있으면 네이티브를 다시 호출하지 않는다.
 * @returns 캐시에 적재된 좌표 또는 null(권한 없음·캐시 없음·실패)
 */
export const warmLastKnownLocation = async (): Promise<Coords | null> => {
  if (warmCoords) return warmCoords; // 멱등 — 이미 손에 쥔 좌표가 있으면 네이티브 접촉 0.
  if (warmingPromise) return warmingPromise; // in-flight 가드 — 워밍과 탭 진입이 겹쳐도 1회(E8).

  warmingPromise = fetchLastKnownCoords();
  try {
    return await warmingPromise;
  } finally {
    warmingPromise = null;
  }
};
