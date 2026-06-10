// src/navigation/routes.ts
// 라우트 이름 단일 출처. 문자열 오타로 인한 이동 실패를 컴파일 타임에 차단한다.
export const Routes = {
  Onboarding: 'Onboarding',
  RoomTabs: 'RoomTabs',
  MuklogTab: 'MuklogTab',
  MapTab: 'MapTab',
  Profile: 'Profile',
} as const;

// 루트(인증 후) 스택 파라미터 목록
export type AppStackParamList = {
  [Routes.Onboarding]: undefined;
  [Routes.RoomTabs]: undefined;
  [Routes.Profile]: undefined;
};

// 방 탭 네비게이터 파라미터 목록 (디폴트 = Muklog)
export type RoomTabParamList = {
  [Routes.MuklogTab]: undefined;
  [Routes.MapTab]: undefined;
};
