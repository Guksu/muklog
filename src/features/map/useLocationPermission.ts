// src/features/map/useLocationPermission.ts
// 현재위치 권한 요청·상태 훅 (plan §3.3·§4·§6·§7 경계면).
//   생산자: expo-location(권한·현재위치). 소비자: MapTabScreen·initialRegion·지도뷰 center(me).
//
// 정책: 진입 시 1회 request()(MapTabScreen이 undetermined일 때 호출). FAB 탭 시 refreshCoords()로
//   현재위치 1회 재취득(탭당 1회, in-flight 가드). 폴링·watchPosition 미사용(비용·배터리).
//   거부/모듈 throw는 denied로 흡수 → 지도는 차단하지 않는다(현재위치 마커만 생략, plan §4 denied).
//   granted지만 위치 획득 실패(타임아웃)는 coords null로 둔다 → initialRegion이 핀 bbox로 폴백(무한 로딩 금지 §6).
import { useRef, useState } from 'react';

import * as Location from 'expo-location';

import { LocationPermissionStatus, type Coords } from './types';

/**
 * 현재위치 권한을 요청하고 상태·좌표를 제공하는 훅(expo-location 래핑).
 * @returns status(권한 상태) · coords(granted+획득 시만, 아니면 null) · request(권한 요청 함수)
 *   · refreshCoords(탭 시 현재위치 1회 재취득 함수)
 */
export const useLocationPermission = () => {
  const [status, setStatus] = useState<LocationPermissionStatus>(
    LocationPermissionStatus.Undetermined,
  );
  const [coords, setCoords] = useState<Coords | null>(null);
  const requestedRef = useRef(false);
  // refreshCoords in-flight 가드(연타 시 getCurrentPositionAsync 중복 호출 0, plan §3.6·§8).
  const refreshingRef = useRef(false);
  // 폴백용 최신 coords 보관(클로저 stale 방지 — refreshCoords가 실패 시 직전 값 참조).
  const coordsRef = useRef<Coords | null>(null);
  coordsRef.current = coords;

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
      // 권한 모듈 throw → denied로 흡수(지도 차단 안 함).
      setStatus(LocationPermissionStatus.Denied);
      return;
    }

    if (!granted) {
      setStatus(LocationPermissionStatus.Denied);
      return;
    }

    setStatus(LocationPermissionStatus.Granted);
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      coordsRef.current = next;
      setCoords(next);
    } catch {
      // granted지만 위치 획득 실패 → coords null 유지(initialRegion이 핀 bbox로 폴백, 무한 로딩 금지).
    }
  };

  // 탭 시 현재위치를 1회 재취득한다(폴링/watchPosition 금지, 탭당 1회 — plan §3.6·§8).
  //   granted 아니면 null. in-flight 가드로 연타 중복 0. 실패/타임아웃 시 직전 coords 폴백(없으면 null).
  const refreshCoords = async (): Promise<Coords | null> => {
    if (status !== LocationPermissionStatus.Granted) return null; // 권한 없으면 위치 호출 0.
    if (refreshingRef.current) return coordsRef.current; // 이미 재취득 진행 중 → 중복 호출 0.
    refreshingRef.current = true;
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      coordsRef.current = next;
      setCoords(next);
      return next;
    } catch {
      // 실패(타임아웃) → 직전 coords 폴백(없으면 null). throw 전파 안 함.
      return coordsRef.current;
    } finally {
      refreshingRef.current = false;
    }
  };

  return { status, coords, request, refreshCoords };
};
