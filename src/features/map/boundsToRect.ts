// src/features/map/boundsToRect.ts
// BOUNDS_CHANGED의 sw/ne → nearby-search Edge 요청 본문 (plan §3.4·§7 경계면).
//   생산자: useNearbyPlaces가 setBounds 받은 bbox를. 소비자: searchNearby({ sw, ne }).
//   책임 경계: 직렬화/패스스루만. 역전(min>max)·NaN·미세이동 가드는 useNearbyPlaces가 1차로 한다(쿼터 보호).
//   Edge는 2차로 BOUNDS_REQUIRED 검증. 유틸을 패스스루로 두는 이유 = 요청 shape 단일 출처(테스트로 고정).
import { type Coords } from './types';

/**
 * BOUNDS_CHANGED sw/ne를 nearby-search 요청 본문으로 직렬화한다(패스스루).
 * @param sw 남서(min) 코너 좌표
 * @param ne 북동(max) 코너 좌표
 * @returns Edge invoke body { sw, ne }
 */
export const boundsToRect = ({ sw, ne }: { sw: Coords; ne: Coords }): { sw: Coords; ne: Coords } => ({
  sw,
  ne,
});
