// src/navigation/routes.ts
// 라우트 이름 단일 출처. 문자열 오타로 인한 이동 실패를 컴파일 타임에 차단한다.
// 멀티 로그 전환(multi-log-home): RoomTabs→HomeTabs, MuklogTab→LogList. Onboarding 제거(게이트 삭제).
//   LogScreen(로그 상세) 추가. log-invite: JoinLog(초대코드 입장) 등록.
export const Routes = {
  HomeTabs: 'HomeTabs', // 인증 후 첫 화면(탭 네비게이터)
  LogList: 'LogList', // 탭1 — 내 로그 목록
  MapTab: 'MapTab', // 탭2 — 지도(stub)
  Profile: 'Profile', // 스택 — 프로필 편집(헤더 진입)
  LogScreen: 'LogScreen', // 스택 — 로그 상세(초대코드 표시·복사 + 솔로/커플 분기)
  JoinLog: 'JoinLog', // 스택 — 초대코드 입장(6셀 코드 입력 → join_room)
} as const;

// 루트(인증 후) 스택 파라미터 목록
export type AppStackParamList = {
  [Routes.HomeTabs]: undefined;
  [Routes.Profile]: undefined;
  [Routes.LogScreen]: { roomId: string };
  [Routes.JoinLog]: undefined;
};

// 홈 탭 네비게이터 파라미터 목록 (디폴트 = LogList)
export type HomeTabParamList = {
  [Routes.LogList]: undefined;
  [Routes.MapTab]: undefined;
};
