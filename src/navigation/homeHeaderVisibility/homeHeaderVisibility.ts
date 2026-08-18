// src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts
// 홈 탭(HomeTabs)의 공통 커스텀 헤더(HomeHeader) 표시 정책 단일 출처.
//
// map-headerless: 지도 탭만 헤더 없이 지도가 상태바까지 차오른다(킷 mk-home:334-336의 헤더 있는
//   MapScreen에서 의도적으로 이탈 — 사용자 요청 "지도 풀블리드"). 나머지 탭은 전부 헤더를 유지한다.
// 정책을 순수 함수로 뽑아 둔 이유: "어느 탭이 헤더를 갖는가"가 네비게이터 옵션 안에 섞여 있으면
//   탭이 늘 때마다 조건이 흩어진다. 여기 한 곳만 보면 되고, 테스트로 못 박힌다.
import { Routes } from '../routes';

/**
 * 홈 탭 화면이 공통 커스텀 헤더(HomeHeader)를 표시해야 하는지 판단한다.
 * @param routeName 탭 라우트 이름(react-navigation route.name 그대로)
 * @returns 헤더를 표시해야 하면 true. 미지의 라우트명은 true로 폴백(신규 탭은 헤더 유지가 기본).
 */
export const shouldShowHomeHeader = ({ routeName }: { routeName: string }): boolean =>
  routeName !== Routes.MapTab;
