// src/features/map/useLocationPermission.ts
// 현재위치 권한 요청·상태 훅 (plan §3.3·§4·§6·§7 경계면).
//   생산자: expo-location(권한·현재위치) + lastKnownLocation(OS 캐시 위치 메모리 캐시).
//   소비자: MapTabScreen·initialRegion·지도뷰 center(me).
//
// 정책: 진입 시 1회 request()(MapTabScreen이 undetermined일 때 호출). FAB 탭 시 refreshCoords()로
//   현재위치 1회 재취득(탭당 1회, in-flight 가드). 폴링·watchPosition 미사용(비용·배터리).
//   거부/모듈 throw는 denied로 흡수 → 지도는 차단하지 않는다(현재위치 마커만 생략, plan §4 denied).
//
// map-initial-location: 좌표는 "언제 손에 쥐었나"가 아니라 "얼마나 정밀한가"로 구분한다(coordsSource).
//   warm  = OS 캐시(마지막 위치, 근사) — 앱 구동 워밍(LocationPrewarm) 또는 탭 진입 즉시 시드.
//   fresh = 이번 세션의 실제 GPS 픽스(정밀).
//   첫 렌더에 warm 캐시를 동기 시드해(useState lazy initializer) initialRegion이 렌더 1부터 실좌표를
//   받게 하고, fresh가 도착하면 승격한다. fresh 실패 시엔 warm을 유지해 지도가 근사 위치로라도 뜬다(R3).
import { useRef, useState } from 'react';

import * as Location from 'expo-location';

import {
  clearWarmCoords,
  readWarmCoords,
  warmLastKnownLocation,
  writeWarmCoords,
} from '../lastKnownLocation';
import {
  LocationCoordsSource,
  LocationPermissionStatus,
  type Coords,
  type LocationFix,
} from '../types';

/** 좌표와 그 출처는 항상 짝으로 움직인다(불일치 상태 원천 차단) — 단일 state로 묶어 원자적으로 갱신. */
type CoordsState = { coords: Coords | null; source: LocationCoordsSource | null };

const EMPTY_COORDS_STATE: CoordsState = { coords: null, source: null };

/**
 * 현재 좌표 상태를 소비자에게 돌려줄 재취득 결과로 환산한다.
 * @param state 훅 내부의 좌표 상태(좌표·출처 쌍)
 * @returns 좌표를 보유했으면 `{coords, source}`, 없으면 null
 */
const toLocationFix = ({ state }: { state: CoordsState }): LocationFix | null =>
  state.coords && state.source ? { coords: state.coords, source: state.source } : null;

/**
 * 현재위치 권한을 요청하고 상태·좌표를 제공하는 훅(expo-location 래핑).
 * @returns status(권한 상태) · coords(warm 캐시 시드 또는 취득 좌표, 없으면 null)
 *   · coordsSource(warm|fresh, coords가 null이면 null) · request(권한 요청 함수)
 *   · refreshCoords(탭 시 현재위치 1회 재취득 함수)
 */
export const useLocationPermission = () => {
  const [status, setStatus] = useState<LocationPermissionStatus>(
    LocationPermissionStatus.Undetermined,
  );
  // lazy initializer — 앱 구동 워밍이 채워둔 캐시를 첫 렌더에 동기로 읽는다(레이스 없음, E9).
  //   캐시를 폴링/구독하지 않는다(E10) — 워밍이 늦게 끝나면 아래 request() 경로가 자기 몫으로 취득한다.
  const [coordsState, setCoordsState] = useState<CoordsState>(() => {
    const warm = readWarmCoords();
    return warm ? { coords: warm, source: LocationCoordsSource.Warm } : EMPTY_COORDS_STATE;
  });
  const requestedRef = useRef(false);
  // refreshCoords in-flight 가드(연타 시 getCurrentPositionAsync 중복 호출 0, plan §3.6·§8).
  const refreshingRef = useRef(false);
  // 폴백용 최신 좌표·출처 보관(클로저 stale 방지 — refreshCoords가 실패 시 직전 값을 출처째로 참조).
  const coordsStateRef = useRef<CoordsState>(EMPTY_COORDS_STATE);
  coordsStateRef.current = coordsState;

  // 일반 함수(useCallback 지양). request는 MapTabScreen이 진입 시 1회 호출한다.
  const request = async () => {
    // 중복 요청 가드(연속 탭/리렌더 — OS 다이얼로그 중복 방지).
    if (requestedRef.current) return;
    requestedRef.current = true;
    setStatus(LocationPermissionStatus.Requesting);

    let granted = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      granted = permission.status === 'granted';
    } catch {
      // 권한 모듈 throw → denied로 흡수(지도 차단 안 함). 권한 없는 채로 stale 좌표를 그리지 않는다(R4·E7).
      setStatus(LocationPermissionStatus.Denied);
      clearWarmCoords();
      coordsStateRef.current = EMPTY_COORDS_STATE;
      setCoordsState(EMPTY_COORDS_STATE);
      return;
    }

    if (!granted) {
      setStatus(LocationPermissionStatus.Denied);
      clearWarmCoords();
      coordsStateRef.current = EMPTY_COORDS_STATE;
      setCoordsState(EMPTY_COORDS_STATE);
      return;
    }

    setStatus(LocationPermissionStatus.Granted);

    // ① 앱 구동 워밍이 없었던 경우의 2차 안전망(R2 ①) — OS 캐시를 먼저 시드해 fresh 픽스를 기다리는
    //    수백 ms~수 초 동안에도 지도가 폴백(서울시청)이 아닌 내 동네를 센터로 잡게 한다.
    //    GPS를 깨우지 않으므로 배터리 비용 0. 이미 좌표를 쥐고 있으면 건너뛴다.
    if (!coordsStateRef.current.coords) {
      const warm = await warmLastKnownLocation();
      if (warm) {
        const seeded = { coords: warm, source: LocationCoordsSource.Warm };
        coordsStateRef.current = seeded;
        setCoordsState(seeded);
      }
    }

    // ② 정밀 픽스 — 성공하면 fresh로 승격하고 캐시도 갱신(다음 마운트는 정밀 좌표로 시작, E14).
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      const fixed = { coords: next, source: LocationCoordsSource.Fresh };
      coordsStateRef.current = fixed;
      setCoordsState(fixed);
      writeWarmCoords({ coords: next });
    } catch {
      // granted지만 위치 획득 실패 → warm 좌표가 있으면 그대로 유지(R3), 없으면 coords null 유지
      //   → initialRegion이 핀 bbox/DEFAULT_REGION으로 폴백(무한 로딩 금지).
    }
  };

  // 탭 시 현재위치를 1회 재취득한다(폴링/watchPosition 금지, 탭당 1회 — plan §3.6·§8).
  //   granted 아니면 null. in-flight 가드로 연타 중복 0. 실패/타임아웃 시 직전 좌표 폴백(없으면 null).
  //   반환은 좌표와 **그 좌표의 실제 출처** 쌍이다 — 실패 폴백 시 직전 좌표가 warm일 수 있으므로,
  //   소비자가 "FAB로 받았으니 fresh겠지"라고 추정하면 근사 좌표에 정밀 딱지를 붙이게 된다(오마킹 차단).
  const refreshCoords = async (): Promise<LocationFix | null> => {
    if (status !== LocationPermissionStatus.Granted) return null; // 권한 없으면 위치 호출 0.
    // 이미 재취득 진행 중 → 중복 호출 0. 현재 쥐고 있는 좌표를 그 출처와 함께 돌려준다.
    if (refreshingRef.current) return toLocationFix({ state: coordsStateRef.current });
    refreshingRef.current = true;
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      const fixed = { coords: next, source: LocationCoordsSource.Fresh };
      coordsStateRef.current = fixed;
      setCoordsState(fixed);
      writeWarmCoords({ coords: next });
      return fixed;
    } catch {
      // 실패(타임아웃) → 직전 좌표·출처 그대로 폴백(없으면 null). throw 전파 안 함.
      return toLocationFix({ state: coordsStateRef.current });
    } finally {
      refreshingRef.current = false;
    }
  };

  return {
    status,
    coords: coordsState.coords,
    coordsSource: coordsState.source,
    request,
    refreshCoords,
  };
};
