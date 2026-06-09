// src/navigation/devFlags.ts
// ⚠️ 임시(setup 스프린트 한정) — invite-room 스프린트에서 제거 대상.
//
// 이번 스프린트에는 방 멤버십 조회 로직이 없으므로 Onboarding ↔ RoomTabs 실제 분기를 만들 수 없다.
// 대신 두 경로에 모두 도달 가능하도록 임시 토글을 둔다. QA는 "분기 자체가 동작"만 검증한다.
//
// TODO(invite-room): 이 플래그/화면 내 dev 버튼을 제거하고, AppNavigator의 initialRoute를
//   `room_members`에 본인 멤버십이 있으면 RoomTabs, 없으면 Onboarding 으로 교체한다.
export const DEV_NAV = {
  /** 앱 시작 시 도달 화면. 'onboarding' | 'room'. 기본 onboarding. */
  initial: 'onboarding' as 'onboarding' | 'room',
  /** 화면 내 임시 토글 버튼 노출 여부. */
  showToggle: true,
};
