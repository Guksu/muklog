// src/features/map/useLocationPermission.ts
// 현재위치 권한 요청·상태 훅 (plan §3.3·§4·§6·§7 경계면).
//   생산자: expo-location(권한·현재위치). 소비자: MapTabScreen·initialRegion·지도뷰 center(me).
//
// 정책: 진입 시 1회 request()(MapTabScreen이 undetermined일 때 호출). 폴링·watchPosition 미사용(비용·배터리).
//   거부/모듈 throw는 denied로 흡수 → 지도는 차단하지 않는다(현재위치 마커만 생략, plan §4 denied).
//   granted지만 위치 획득 실패(타임아웃)는 coords null로 둔다 → initialRegion이 핀 bbox로 폴백(무한 로딩 금지 §6).
import { useRef, useState } from 'react';

import * as Location from 'expo-location';

import { LocationPermissionStatus, type Coords } from './types';

/**
 * 현재위치 권한을 요청하고 상태·좌표를 제공하는 훅(expo-location 래핑).
 * @returns status(권한 상태) · coords(granted+획득 시만, 아니면 null) · request(권한 요청 함수)
 */
export const useLocationPermission = () => {
  const [status, setStatus] = useState<LocationPermissionStatus>(
    LocationPermissionStatus.Undetermined,
  );
  const [coords, setCoords] = useState<Coords | null>(null);
  const requestedRef = useRef(false);

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
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      // granted지만 위치 획득 실패 → coords null 유지(initialRegion이 핀 bbox로 폴백, 무한 로딩 금지).
    }
  };

  return { status, coords, request };
};
