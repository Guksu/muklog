// src/navigation/routes.ts
// 라우트 이름 단일 출처. 문자열 오타로 인한 이동 실패를 컴파일 타임에 차단한다.
// 멀티 로그 전환(multi-log-home): RoomTabs→HomeTabs, MuklogTab→LogList. Onboarding 제거(게이트 삭제).
//   LogScreen(로그 상세) 추가. log-invite: JoinLog(초대코드 입장) 등록.
//   ui-fidelity FLAG-1/3: MuklogEditor(에디터 풀스크린 — 시트→화면) · RoomCreated(생성완료 축하) 등록.
export const Routes = {
  HomeTabs: 'HomeTabs', // 인증 후 첫 화면(탭 네비게이터)
  LogList: 'LogList', // 탭1 — 내 로그 목록
  MapTab: 'MapTab', // 탭2 — 지도(stub)
  Profile: 'Profile', // 스택 — 프로필 편집(헤더 진입)
  LogScreen: 'LogScreen', // 스택 — 로그 상세(초대코드 표시·복사 + 솔로/커플 분기)
  JoinLog: 'JoinLog', // 스택 — 초대코드 입장(6셀 코드 입력 → join_room)
  MuklogDetail: 'MuklogDetail', // 스택 — 먹로그 상세(읽기 전용 · 사진 캐러셀). param { muklogId }
  // FLAG-1: 먹로그 작성/편집 에디터(풀스크린, SubBar+저장). muklogId 있으면 편집, 없으면 작성. param { roomId, muklogId? }
  MuklogEditor: 'MuklogEditor',
  // FLAG-3: 로그 생성 완료 축하(킷 mk-home CreatedScreen) — 초대코드 공유 + 로그 열기/나중에. param { roomId, code }
  RoomCreated: 'RoomCreated',
} as const;

// 위시 "다녀왔어요" → MuklogEditor 생성 모드 프리필(wishlist plan §4.5). 위시 항목의 place 필드를 그대로 싣어
//   재검색 없이 작성 화면에 채운다. address는 위시에 미저장 → 생성 시 null(좌표/road만 보존).
export type MuklogEditorPrefill = {
  placeName: string;
  category: string | null;
  area: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  kakaoPlaceId: string | null;
};

// 루트(인증 후) 스택 파라미터 목록
export type AppStackParamList = {
  [Routes.HomeTabs]: undefined;
  [Routes.Profile]: undefined;
  [Routes.LogScreen]: { roomId: string };
  [Routes.JoinLog]: undefined;
  // 상세는 muklogId만 받고 자체 조회(roomId는 조회 결과의 room_id로 충분, RLS가 권한 차단). plan §4.1.
  [Routes.MuklogDetail]: { muklogId: string };
  // 에디터: roomId(저장 대상) + muklogId(있으면 편집 프리필 조회, 없으면 작성). FLAG-1.
  //   wishlist: 위시 "다녀왔어요" → muklogId 없음 + prefill 있음 = 생성 모드 + 프리필. 생성 성공 시 fromWishlistId 위시 삭제.
  [Routes.MuklogEditor]: {
    roomId: string;
    muklogId?: string;
    prefill?: MuklogEditorPrefill;
    fromWishlistId?: string;
  };
  // 생성 완료 축하: 방금 만든 로그의 roomId + 공유용 초대코드(createRoom 반환값 직접 전달). FLAG-3.
  [Routes.RoomCreated]: { roomId: string; code: string };
};

// 홈 탭 네비게이터 파라미터 목록 (디폴트 = LogList)
export type HomeTabParamList = {
  [Routes.LogList]: undefined;
  [Routes.MapTab]: undefined;
};
