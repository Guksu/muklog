// src/navigation/screens/LogScreen.spec.tsx
// 로그 진입(B2) — useRoom 조회 → 헤더(아바타 겹침+로그명) + 초대영역(솔로 InviteCodeCard / 커플 컴팩트 코드행) 분기.
//   로딩/에러/roomId 누락 방어 + MuklogList 마운트. (plan §5 B2 / §6.1). ⚠️ AC3: 커플도 코드 노출(plan §118).
//   invite-share(U72·U37, plan R12 — AC12·AC13): 참여자 "초대"와 솔로 이름 변경 다이얼로그 카드는 useInviteShare로 배선한다
//     (공유 = shareInvite, 복사 = copyInviteCode). 공유 시트·토스트 동작 자체는 useInviteShare.spec이 본다.
import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockParams: { current: unknown } = { current: { roomId: 'r1' } };
const mockGoBack = jest.fn();
// wishlist-visit-double-tap(U67): 위시 "기록하기"의 전환 중 재탭 가드가 읽는 isFocused()를 더한다(지도 탭 spec과 같은 흉내).
//   실제처럼 navigate가 일어나면 로그 화면이 포커스를 잃는다(beforeEach의 mockImplementation — blur 정리 함수까지) —
//   항상 true인 더블은 가드를 지워도 green이라 잠그지 못한다. push·dispatch는 두지 않는다(push로 바꾼 구현은 TypeError로 실패한다).
const mockNavigate = jest.fn();
const mockNavState: { focused: boolean } = { focused: true };
// room-lifecycle(T9~T11) — useLeaveRoom/useCancelRoomDeletion 더블 + loading/error 가변 상태.
const mockLeaveRoom = jest.fn();
const mockCancelRoomDeletion = jest.fn();
const mockLeaveHookState: { loading: boolean; error: string | null } = { loading: false, error: null };
const mockCancelHookState: { loading: boolean; error: string | null } = { loading: false, error: null };
// invite-share(U72) — useInviteShare 더블(공유·복사 호출 인자만 본다).
const mockShareInvite = jest.fn();
const mockCopyInviteCode = jest.fn();
// useFocusEffect 더블 — 실제 useFocusEffect(@react-navigation/core)처럼 ① 화면이 등록한 포커스 효과를 훅 자리마다 **전부**
//   보관하고 ② 마운트(또는 효과가 바뀔 때) 화면이 포커스면 바로 발화해 반환된 정리 함수를 저장했다가(첫 포커스)
//   ③ 로그 화면이 포커스를 잃을 때(blur = navigate) 부른다. 복귀는 focusLogScreen이 쉬던 효과를 다시 발화한다.
//   마지막 콜백 하나만 보관하고 정리 함수를 버리던 더블은 "화면을 떠날 때 세그를 '기록'으로 되돌리거나 검색뷰를 여는"
//   회귀(blur 정리 함수)를 통과시켰다 — 에디터에서 돌아오면 위시 목록이 사라지는데 green이었다
//   (wishlist-visit-double-tap QA 반영, 지도 탭 spec의 map-wish-card-visit 더블과 같은 방식).
type MockFocusEntry = {
  effect: () => void | (() => void);
  cleanup: void | (() => void);
  active: boolean;
};
const mockFocus: { entries: MockFocusEntry[] } = { entries: [] };
jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    useRoute: () => ({ params: mockParams.current }),
    useNavigation: () => ({
      goBack: mockGoBack,
      navigate: mockNavigate,
      isFocused: () => mockNavState.focused,
    }),
    // 훅 자리마다 항목 하나(useRef). 매 렌더 최신 효과로 바꿔 끼운다.
    //   효과가 바뀌면(실제 deps [effect]) 이전 정리 함수를 부르고, 화면이 포커스면 새 효과를 발화한다.
    //   언마운트 때 정리 함수를 부르고 목록에서 뺀다(실제 useFocusEffect의 effect cleanup과 같은 순서).
    useFocusEffect: (effect: () => void | (() => void)) => {
      const entryRef = ReactLib.useRef(null);
      if (entryRef.current === null) {
        entryRef.current = { effect, cleanup: undefined, active: false };
        mockFocus.entries.push(entryRef.current);
      }
      entryRef.current.effect = effect;
      ReactLib.useEffect(
        function runFocusEffectIfFocused() {
          const entry = entryRef.current;
          if (mockNavState.focused) {
            entry.cleanup = effect();
            entry.active = true;
          }
          return function cleanupFocusEffect() {
            if (entry.active && typeof entry.cleanup === 'function') entry.cleanup();
            entry.cleanup = undefined;
            entry.active = false;
          };
        },
        [effect],
      );
      ReactLib.useEffect(function unregisterFocusEntryOnUnmount() {
        const entry = entryRef.current;
        return function dropFocusEntry() {
          mockFocus.entries = mockFocus.entries.filter((it: MockFocusEntry) => it !== entry);
        };
      }, []);
    },
  };
});

/**
 * 로그 화면 포커스(다른 화면에서 복귀) — isFocused()를 true로 되돌리고, 포커스를 잃어 쉬던 효과를 전부 발화해
 * 정리 함수를 저장한다. 이미 포커스 상태로 발화한 효과는 다시 부르지 않는다(실제 focus 리스너의 중복 가드).
 */
const focusLogScreen = () => {
  mockNavState.focused = true;
  for (const entry of mockFocus.entries) {
    if (entry.active) continue;
    entry.cleanup = entry.effect();
    entry.active = true;
  }
};

/** 로그 화면 blur(에디터·상세가 위에 쌓임) — isFocused()를 false로 바꾸고 저장된 정리 함수를 부른 뒤 비운다. */
const blurLogScreen = () => {
  mockNavState.focused = false;
  for (const entry of mockFocus.entries) {
    if (!entry.active) continue;
    if (typeof entry.cleanup === 'function') entry.cleanup();
    entry.cleanup = undefined;
    entry.active = false;
  }
};

/** 재포커스(에디터·상세에 다녀옴) 흉내 — 떠났다가(blur) 돌아온다(focus). 이미 떠난 상태면 blur는 할 일이 없다. */
const refireFocus = () => {
  blurLogScreen();
  focusLogScreen();
};

// safe-area: 헤더 top inset 동적 반영(킷 MK_STATUS_PAD=56 고정 → insets.top 번역) 검증용으로 가변 모킹.
//   네이티브 헤더 OFF(headerShown:false)로 사라진 top inset을 자체 헤더가 보전하는지 lock.
const mockTopInset: { current: number } = { current: 0 };
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: mockTopInset.current, bottom: 0, left: 0, right: 0 }),
  };
});

// 배럴 모킹: useRoom·useRenameRoom 모킹 + displayLogName/code는 실 구현(표시명 로직 직접 검증).
//   LogTitleButton는 경량 테스트 더블로 대체 — 실 구현은 @/components를 거쳐 배럴을 재유입(순환)시켜
//   TDZ를 유발한다. RenameDialog는 @/components(별도 모킹)에서 controlled 더블로 대체. 배선 로직(open/save/error/disabled/extra 게이팅)만 검증.
jest.mock('@/features/room', () => {
  const ReactLib = require('react');
  const { Pressable, Text, View } = require('react-native');
  const h = ReactLib.createElement;
  const code = jest.requireActual('@/features/room/code');
  const logName = jest.requireActual('@/features/room/logName');
  // deletionCountdownLabel·errors(mapRoomError)는 실 구현(라벨 계산·취소 실패 토스트 메시지 직접 검증).
  const countdown = jest.requireActual('@/features/room/deletionCountdownLabel');
  const errors = jest.requireActual('@/features/room/errors');
  // 더블: display-only 제목(탭 동작 없음). 이름 변경은 ⋯메뉴 "로그 이름 변경"으로 이전. avatarSlot는 그대로 렌더.
  const LogTitleButton = ({ title, avatarSlot }: { title: string; avatarSlot?: unknown }) =>
    h(View, null, avatarSlot, h(Text, null, title));
  // 나가기 시트 probe — 배선(menu/confirm/couple/leaving/leaveError props + 콜백)만 검증. 카피·비주얼은 LeaveLogSheets.spec.
  const LeaveLogSheets = (props: Record<string, unknown>) =>
    h(
      View,
      { accessibilityLabel: 'leave-log-sheets' },
      h(
        Text,
        null,
        `menu:${props.menuVisible}|confirm:${props.confirmVisible}|couple:${props.isCouple}|leaving:${props.leaving}|err:${props.leaveError ?? '-'}`,
      ),
      h(Pressable, { accessibilityLabel: 'probe-select-rename', onPress: props.onSelectRename as () => void }),
      h(Pressable, { accessibilityLabel: 'probe-select-leave', onPress: props.onSelectLeave as () => void }),
      h(Pressable, { accessibilityLabel: 'probe-confirm-leave', onPress: props.onConfirmLeave as () => void }),
      h(Pressable, { accessibilityLabel: 'probe-close-menu', onPress: props.onCloseMenu as () => void }),
      h(Pressable, { accessibilityLabel: 'probe-close-confirm', onPress: props.onCloseConfirm as () => void }),
    );
  // 예약삭제 배너 probe — countdownLabel/isRequester/canceling props + onCancel 콜백 검증. 노출 게이팅은 LogScreen.
  const ScheduledDeletionBanner = (props: Record<string, unknown>) =>
    h(
      View,
      { accessibilityLabel: 'scheduled-deletion-banner' },
      h(Text, null, `requester:${props.isRequester}|canceling:${props.canceling}|label:${props.countdownLabel}`),
      h(Pressable, { accessibilityLabel: 'probe-cancel-deletion', onPress: props.onCancel as () => void }),
    );
  // 참여자 블록 probe(members-display S5b) — members 수/meId/canInvite props + onInvite 콜백 검증(비주얼은 ParticipantBlock.spec).
  const ParticipantBlock = (props: Record<string, unknown>) =>
    h(
      View,
      { accessibilityLabel: 'participant-block' },
      h(
        Text,
        null,
        `참여자 ${(props.members as unknown[]).length}|canInvite:${props.canInvite}|meId:${props.meId}`,
      ),
      h(Pressable, { accessibilityLabel: 'probe-invite', onPress: props.onInvite as () => void }),
    );
  return {
    ...code,
    ...logName,
    ...countdown,
    ...errors,
    useRoom: jest.fn(),
    useRoomMembers: jest.fn(),
    useRenameRoom: jest.fn(),
    useLeaveRoom: () => ({
      leaveRoom: mockLeaveRoom,
      loading: mockLeaveHookState.loading,
      error: mockLeaveHookState.error,
    }),
    useCancelRoomDeletion: () => ({
      cancelRoomDeletion: mockCancelRoomDeletion,
      loading: mockCancelHookState.loading,
      error: mockCancelHookState.error,
    }),
    useInviteShare: () => ({ shareInvite: mockShareInvite, copyInviteCode: mockCopyInviteCode }),
    LogTitleButton,
    LeaveLogSheets,
    ScheduledDeletionBanner,
    ParticipantBlock,
  };
});

// RenameDialog는 공용 프리미티브(@/components) — 자체 spec에서 비주얼/동작 검증. 여기선 controlled 배선만 보는 더블로 대체.
//   open일 때만 입력(label=title)·subtitle·에러·extra(label "rename-extra")·취소/저장(label) 렌더. value/onChange는 부모 소유(controlled).
jest.mock('@/components', () => {
  const actual = jest.requireActual('@/components');
  const ReactLib = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  const h = ReactLib.createElement;
  const RenameDialog = ({
    open,
    title,
    subtitle,
    value,
    onChange,
    onCancel,
    onSave,
    placeholder,
    extra,
    saving = false,
    error = null,
    saveDisabled = false,
  }: {
    open: boolean;
    title: string;
    subtitle?: string;
    value: string;
    onChange: (next: string) => void;
    onCancel: () => void;
    onSave: () => void;
    placeholder?: string;
    extra?: unknown;
    saving?: boolean;
    error?: string | null;
    saveDisabled?: boolean;
  }) => {
    if (!open) return null;
    const disabled = saving || saveDisabled;
    return h(
      View,
      { accessibilityLabel: 'rename-dialog' },
      h(Text, null, title),
      subtitle ? h(Text, null, subtitle) : null,
      h(TextInput, { accessibilityLabel: title, value, onChangeText: onChange, placeholder }),
      error ? h(Text, null, error) : null,
      extra ? h(View, { accessibilityLabel: 'rename-extra' }, extra) : null,
      h(Pressable, { accessibilityLabel: '취소', onPress: onCancel }, h(Text, null, '취소')),
      h(
        Pressable,
        {
          accessibilityLabel: '저장',
          accessibilityState: { disabled },
          disabled,
          onPress: () => {
            if (!disabled) onSave();
          },
        },
        h(Text, null, '저장'),
      ),
    );
  };
  return { ...actual, RenameDialog };
});

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));
// 외부 SDK 경계(supabase) 대역 — join-push V3 테스트만 실제 useRoomMembers 를 써서 이 대역의 rpc 로 멤버를 받는다.
//   그 밖의 테스트는 데이터 훅을 통째로 대역하므로 supabase 를 부르지 않는다(실 클라이언트 생성 0).
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

// auth: meId 제공(작성자 라벨 파생용). MuklogList는 더블로 대체(supabase 비유입, 자체 spec에서 검증).
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ state: { status: 'authenticated', userId: 'me-uid' } }),
}));

// 본인 프로필(헤더 로그명/아바타). 배럴만 모킹 — Avatar의 avatarDefault/defaultNickname(서브모듈)는 실 구현 사용.
jest.mock('@/features/profile', () => {
  const defaultNicknameMod = jest.requireActual('@/features/profile/defaultNickname');
  return { ...defaultNicknameMod, useProfileContext: jest.fn() };
});
// 먹로그/위시 데이터 훅 — LogScreen이 소유(세그 카운트). 더블로 state 주입 + 컴포넌트는 probe.
const mockUseMuklogs = jest.fn();
const refreshMuklogs = jest.fn();
const mockUsePlaceSearch = jest.fn();
jest.mock('@/features/muklog', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    useMuklogs: () => mockUseMuklogs(),
    usePlaceSearch: () => mockUsePlaceSearch(),
    // placeFieldsFromItem(검색결과→선택) — 고정 매핑 더블(LogScreen이 AddWishlistInput으로 싣는지 검증).
    placeFieldsFromItem: ({ item }: { item: { kakaoPlaceId: string } }) => ({
      placeName: '성수동 베이커리',
      category: 'cafe',
      area: '성수동',
      address: null,
      roadAddress: '서울 성동구 연무장길 1',
      kakaoPlaceId: item.kakaoPlaceId,
      lat: 37.544,
      lng: 127.055,
    }),
    // MuklogList probe — state(ready/loading) 반영 + roomId·meId 노출('log' 세그에서만 마운트=FAB 존재).
    //   header(초대 영역)는 스크롤 헤더로 주입되므로 probe도 렌더해야 초대 배너가 화면에 나타난다(스크롤-어웨이 전환).
    MuklogList: ({
      roomId,
      meId,
      header,
    }: {
      roomId: string;
      meId: string;
      header?: React.ReactNode;
    }) => (
      <View accessibilityLabel="muklog-list">
        <Text>{`list:${roomId}:${meId}`}</Text>
        {header}
      </View>
    ),
    // PlaceSearchView probe — 위시 추가 검색 스왑. 결과선택/직접입력/뒤로 트리거 노출.
    //   U6-b(silent-failure-feedback T6): submitting/submittingLabel도 그대로 반영한다 —
    //   진행 문구 노출과 행 비활성(콜백 차단)은 실제 컴포넌트가 계약대로 하는 일이고(PlaceSearchView.spec가 lock),
    //   여기선 LogScreen이 그 두 prop을 옳게 내려보내는지만 본다.
    PlaceSearchView: (props: Record<string, unknown>) => {
      const submitting = props.submitting === true;
      return (
        <View accessibilityLabel="place-search">
          {submitting ? <Text>{(props.submittingLabel as string) ?? '처리 중…'}</Text> : null}
          <Pressable
            accessibilityLabel="search-pick"
            disabled={submitting}
            onPress={() => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 테스트 probe: 명명 파라미터 타입은 jest.mock hoist가 거부.
              (props.onSelectResult as Function)({ item: { kakaoPlaceId: '12345' } });
            }}
          />
          <Pressable
            accessibilityLabel="search-manual"
            disabled={submitting}
            onPress={props.onUseManualInput as () => void}
          />
          <Pressable accessibilityLabel="search-back" onPress={props.onBack as () => void} />
        </View>
      );
    },
  };
});

// 위시 데이터 훅 + WishlistView probe(onAdd/onVisit/onRemove 트리거 노출).
const mockUseWishlist = jest.fn();
const refreshWishlist = jest.fn();
const mockAddWishlist = jest.fn();
const mockRemoveWishlist = jest.fn();
const mockWishlistExists = jest.fn();
jest.mock('@/features/wishlist', () => {
  const { View, Text, Pressable } = require('react-native');
  // errors(mapWishlistError)는 실 구현 — U6 실패 토스트 문구가 지도 담기(useAddNearbyWish)와 글자까지 같은지 직접 검증한다.
  const errors = jest.requireActual('@/features/wishlist/errors');
  return {
    ...errors,
    useWishlist: () => mockUseWishlist(),
    useAddWishlist: () => ({ addWishlist: mockAddWishlist, loading: false, error: null }),
    wishlistExists: (args: { roomId: string; kakaoPlaceId: string }) => mockWishlistExists(args),
    useRemoveWishlist: () => ({ removeWishlist: mockRemoveWishlist, loading: false, error: null }),
    WishlistView: (props: Record<string, unknown>) => {
      const items = props.items as { id: string; placeName: string }[];
      return (
        <View accessibilityLabel="wishlist-view">
          <Pressable accessibilityLabel="wish-add" onPress={props.onAdd as () => void} />
          {items.map((it) => (
            <View key={it.id}>
              <Text>{`wish:${it.placeName}`}</Text>
              <Pressable
                accessibilityLabel={`wish-visit-${it.id}`}
                onPress={() => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 테스트 probe: 명명 파라미터 타입은 jest.mock hoist가 거부.
                  (props.onVisit as Function)({ id: it.id });
                }}
              />
              <Pressable
                accessibilityLabel={`wish-remove-${it.id}`}
                onPress={() => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 테스트 probe: 명명 파라미터 타입은 jest.mock hoist가 거부.
                  (props.onRemove as Function)({ id: it.id });
                }}
              />
            </View>
          ))}
        </View>
      );
    },
  };
});

import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { SWAP_TRANSITION_TEST_ID } from '@/components/SwapTransition';
import { useRoom, useRoomMembers, useRenameRoom } from '@/features/room';
import { useProfileContext } from '@/features/profile';
import { supabase } from '@/lib/supabase';
import { LogScreen } from './LogScreen';

const useRoomMock = useRoom as jest.Mock;
const useRoomMembersMock = useRoomMembers as jest.Mock;
const useRenameRoomMock = useRenameRoom as jest.Mock;
const useProfileMock = useProfileContext as jest.Mock;
const refresh = jest.fn();
const membersRefresh = jest.fn();
const renameRoom = jest.fn();

const setRoomState = (state: unknown) => {
  useRoomMock.mockReturnValue({ state, refresh });
};

// members-display S5b — useRoomMembers 상태 주입. 기본: ready + 나(me-uid) 1명(솔로).
const setMembersState = (state: unknown) => {
  useRoomMembersMock.mockReturnValue({ state, refresh: membersRefresh });
};
const memberRow = (userId: string, nickname: string | null = null) => ({
  userId,
  nickname,
  avatarUrl: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
  // 실제 순서 흉내: 이동하면 로그 화면은 포커스를 잃는다(에디터·상세가 위에 쌓임) — isFocused() false + 포커스 효과의
  //   정리 함수 호출(blur). 복귀는 returnToLogScreen(focusLogScreen)이 되돌린다.
  mockFocus.entries = [];
  mockNavState.focused = true;
  mockNavigate.mockImplementation(() => {
    blurLogScreen();
  });
  refresh.mockReset();
  renameRoom.mockReset();
  refreshMuklogs.mockReset();
  refreshWishlist.mockReset();
  mockTopInset.current = 0;
  mockParams.current = { roomId: 'r1' };
  setRoomState({ status: 'loading' });
  // 기본 멤버 상태: ready + 나 1명(솔로). 개별 테스트에서 setMembersState로 오버라이드.
  membersRefresh.mockReset();
  setMembersState({ status: 'ready', members: [memberRow('me-uid', '민지')] });
  useRenameRoomMock.mockReturnValue({ renameRoom, loading: false, error: null });
  useProfileMock.mockReturnValue({
    state: { status: 'ready', profile: { nickname: '민지', avatarUrl: null } },
    refresh: jest.fn(),
  });
  // 위시 스프린트: LogScreen이 소유하는 먹로그/위시/검색 훅 기본값(세그 카운트·본문).
  mockUseMuklogs.mockReturnValue({ state: { status: 'ready', muklogs: [] }, refresh: refreshMuklogs });
  mockUseWishlist.mockReturnValue({ state: { status: 'ready', items: [] }, refresh: refreshWishlist });
  mockUsePlaceSearch.mockReturnValue({
    query: '',
    setQuery: jest.fn(),
    status: 'idle',
    results: [],
    errorMessage: null,
  });
  mockAddWishlist.mockResolvedValue({ id: 'w-new' });
  mockRemoveWishlist.mockResolvedValue(undefined);
  mockWishlistExists.mockReset();
  mockWishlistExists.mockResolvedValue(false);
  // room-lifecycle 더블 초기화.
  mockLeaveRoom.mockReset();
  mockCancelRoomDeletion.mockReset();
  mockLeaveHookState.loading = false;
  mockLeaveHookState.error = null;
  mockCancelHookState.loading = false;
  mockCancelHookState.error = null;
  // invite-share 더블 초기화.
  mockShareInvite.mockReset();
  mockShareInvite.mockResolvedValue(undefined);
  mockCopyInviteCode.mockReset();
  mockCopyInviteCode.mockResolvedValue(undefined);
});

describe('LogScreen', () => {
  it('roomId가 없으면(직접 진입) 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = {};
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('params 자체가 undefined여도 안전 메시지를 표시한다 (AC4·회귀)', () => {
    mockParams.current = undefined;
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy();
  });

  it('loading 상태면 로더를 표시한다', () => {
    setRoomState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByTestId('logscreen-loading')).toBeTruthy();
  });

  it('error 상태면 메시지 + 다시 시도 버튼을 표시하고 코드를 노출하지 않는다 (AC5)', () => {
    setRoomState({ status: 'error', message: '이 로그에 접근할 권한이 없어요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('이 로그에 접근할 권한이 없어요.')).toBeTruthy();
    expect(screen.getByLabelText('다시 시도')).toBeTruthy();
  });

  it('솔로(members 1명)면 참여자 블록(초대 버튼 O)과 "{닉}의 기록" 로그명을 표시한다 (S5b·킷 mk-log:79-103)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    setMembersState({ status: 'ready', members: [memberRow('me-uid', '민지')] });
    renderWithTheme(<LogScreen />);
    // 참여자 블록: "참여자 1" + canInvite(1<5=true). 구 솔로 배너/💌 미렌더(대체됨).
    expect(screen.getByLabelText('participant-block')).toBeTruthy();
    expect(screen.getByText('참여자 1|canInvite:true|meId:me-uid')).toBeTruthy();
    expect(screen.queryByText('함께할 사람을 초대해요')).toBeNull();
    expect(screen.queryByText('💌')).toBeNull();
    // 로그명 = logTitleFromMembers(1명 → "{나}의 기록").
    expect(screen.getByText('민지의 기록')).toBeTruthy();
  });

  it('커플(members 2명)이면 참여자 블록("참여자 2")과 "A · B" 로그명을 표시하고 구 컴팩트 코드행은 미렌더한다 (S5b)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('참여자 2|canInvite:true|meId:me-uid')).toBeTruthy();
    // 구 컴팩트 코드행/복사 버튼 미렌더(참여자 블록으로 통합).
    expect(screen.queryByText('초대코드 ABCDEF')).toBeNull();
    expect(screen.queryByLabelText('초대코드 복사')).toBeNull();
    // 로그명 = logTitleFromMembers(2명 → "A · B", joined_at asc).
    expect(screen.getByText('민지 · 지현')).toBeTruthy();
  });

  it('만석(members 5명)이면 참여자 블록에 canInvite=false(초대 버튼 숨김)를 전달한다 (S5b·엣지 5명)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 5, mode: 'couple' },
    });
    setMembersState({
      status: 'ready',
      members: [
        memberRow('me-uid', '민지'),
        memberRow('u2', '지현'),
        memberRow('u3', '수'),
        memberRow('u4', '아'),
        memberRow('u5', '별'),
      ],
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('참여자 5|canInvite:false|meId:me-uid')).toBeTruthy();
  });

  it('멤버 loading/error면 참여자 블록을 미렌더하되 리스트는 정상 마운트한다 (best-effort, plan §4.1)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    setMembersState({ status: 'loading' });
    const { unmount } = renderWithTheme(<LogScreen />);
    expect(screen.queryByLabelText('participant-block')).toBeNull();
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
    unmount();

    setMembersState({ status: 'error', message: '이 로그에 접근할 권한이 없어요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.queryByLabelText('participant-block')).toBeNull();
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
  });

  // invite-share(U72·U37): 라벨 "초대"와 동작을 맞춘다 — 코드 복사가 아니라 초대 메시지 공유 시트(킷 mk-log:94 이탈, 사용자 승인).
  it('참여자 블록 "초대" 탭 → shareInvite({ code: room.inviteCode }) 1회 — 클립보드 복사·복사 토스트는 없다 (AC12)', async () => {
    const Clipboard = require('expo-clipboard');
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    setMembersState({ status: 'ready', members: [memberRow('me-uid', '민지')] });
    renderWithTheme(<LogScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-invite'));
    });
    expect(mockShareInvite.mock.calls).toStrictEqual([[{ code: 'ABCDEF' }]]);
    expect(mockCopyInviteCode).not.toHaveBeenCalled();
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    expect(screen.queryByText('초대코드를 복사했어요 · ABCDEF')).toBeNull();
  });

  it('커플 로그에서도 참여자 "초대"는 같은 공유로 이어진다(초대 가능 인원이 남은 동안)', async () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'QWERTY', memberCount: 2, mode: 'couple' },
    });
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-invite'));
    });
    expect(mockShareInvite.mock.calls).toStrictEqual([[{ code: 'QWERTY' }]]);
  });

  it('ready면 placeholder 대신 MuklogList(roomId·meId 전달)를 마운트한다 (T11 통합)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.queryByText('맛집 기록은 곧 추가돼요 🍽️')).toBeNull();
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
    expect(screen.getByText('list:r1:me-uid')).toBeTruthy();
  });

  it('커플이어도 MuklogList를 동일하게 마운트한다 (커플/솔로 무관)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple' },
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
  });

  // 회귀(픽스4 헤더): 네이티브 헤더 headerShown:false로 끄면서 사라진 top inset을 자체 헤더가 보전.
  //   킷 MK_STATUS_PAD=56(시뮬레이터 근사 고정)을 RN에선 useSafeAreaInsets().top으로 동적 번역해야 노치/다이나믹 아일랜드 미겹침.
  //   HomeHeader와 동일 패턴(insets.top + spacing[8])을 lock — inset이 커지면 paddingTop도 그만큼 커진다.
  it('헤더 paddingTop이 safe-area top inset을 반영한다 (회귀: 노치/다이나믹 아일랜드 겹침)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple' },
    });

    mockTopInset.current = 0;
    const { unmount } = renderWithTheme(<LogScreen />);
    const padNoInset = StyleSheet.flatten(screen.getByTestId('logscreen-header').props.style).paddingTop;
    unmount();

    const inset = 59;
    mockTopInset.current = inset;
    renderWithTheme(<LogScreen />);
    const padWithInset = StyleSheet.flatten(screen.getByTestId('logscreen-header').props.style).paddingTop;

    // inset>0이면 paddingTop이 정확히 그만큼(=inset) 커진다(상수 베이스 + insets.top).
    expect(padWithInset).toBe(padNoInset + inset);
  });

  it('헤더에 뒤로가기 버튼이 있고 탭하면 navigation.goBack을 호출한다 (킷 mk-log:19)', () => {
    setRoomState({
      status: 'ready',
      room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple', name: null },
    });
    renderWithTheme(<LogScreen />);
    const back = screen.getByLabelText('뒤로 가기');
    expect(back).toBeTruthy();
    fireEvent.press(back);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('LogScreen — 로그 이름(log-name, T6)', () => {
  const readyRoom = (over?: Record<string, unknown>) => ({
    status: 'ready',
    room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 2, mode: 'couple', name: null, ...over },
  });

  it('room.name이 있으면 헤더 제목으로 이름을 표시한다 (name 우선, logTitleFromMembers)', () => {
    setRoomState(readyRoom({ name: '우리 맛집' }));
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
    expect(screen.queryByText('민지 · 지현')).toBeNull();
  });

  it('room.name=null & 멤버 2명이면 멤버-기반 제목("A · B")을 표시한다 (S5b logTitleFromMembers)', () => {
    setRoomState(readyRoom({ name: null, memberCount: 2 }));
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('민지 · 지현')).toBeTruthy();
  });

  it('room.name=null & 멤버 3명이면 "A 외 2명" 제목을 표시한다 (S5b 3명+)', () => {
    setRoomState(readyRoom({ name: null, memberCount: 3 }));
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('u2', '지현'), memberRow('u3', '수')],
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('민지 외 2명')).toBeTruthy();
  });

  it('멤버 미로드(loading)면 제목이 displayLogName 폴백으로 회귀한다 (회귀 0)', () => {
    setRoomState(readyRoom({ name: null, memberCount: 1 }));
    setMembersState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    // 빈 배열 → logTitleFromMembers 내부 displayLogName 폴백(솔로 "{닉}의 기록").
    expect(screen.getByText('민지의 기록')).toBeTruthy();
  });

  it('⋯메뉴 "로그 이름 변경"을 탭하면 이름 편집 다이얼로그가 열린다(타이틀 탭 아님)', () => {
    setRoomState(readyRoom({ name: '우리 맛집' }));
    renderWithTheme(<LogScreen />);
    // 닫힘 상태: 입력(accessibilityLabel "로그 이름")이 없음. 타이틀은 display-only(편집 진입점 아님).
    expect(screen.queryByLabelText('로그 이름')).toBeNull();
    expect(screen.queryByLabelText('로그 이름 편집')).toBeNull();
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    // 열림: 입력 + subtitle(💡 제거, plan D-7) 노출.
    expect(screen.getByLabelText('로그 이름')).toBeTruthy();
    expect(screen.getByText('비워두면 기본 이름으로 돌아가요')).toBeTruthy();
  });

  it('이름 입력 후 저장하면 renameRoom(정규화 전 원문) 호출 → 성공 시 refresh + 시트 닫힘', async () => {
    renameRoom.mockResolvedValueOnce({ roomId: 'r1', name: '새이름' });
    setRoomState(readyRoom({ name: null }));
    renderWithTheme(<LogScreen />);

    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    fireEvent.changeText(screen.getByLabelText('로그 이름'), '새이름');
    fireEvent.press(screen.getByLabelText('저장'));

    await waitFor(() => {
      expect(renameRoom).toHaveBeenCalledWith({ roomId: 'r1', name: '새이름' });
    });
    // 성공 후 useRoom.refresh 1회 + 시트 닫힘.
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('로그 이름')).toBeNull();
    });
  });

  it('빈 입력으로 저장하면 renameRoom에 빈 문자열을 전달한다(서버 정규화 null → 폴백 복귀)', async () => {
    renameRoom.mockResolvedValueOnce({ roomId: 'r1', name: null });
    setRoomState(readyRoom({ name: '기존이름', memberCount: 1 }));
    renderWithTheme(<LogScreen />);

    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    fireEvent.changeText(screen.getByLabelText('로그 이름'), '');
    fireEvent.press(screen.getByLabelText('저장'));

    await waitFor(() => {
      expect(renameRoom).toHaveBeenCalledWith({ roomId: 'r1', name: '' });
    });
  });

  it('저장 실패 시 시트가 닫히지 않고 refresh도 호출하지 않는다(입력 보존·재시도)', async () => {
    renameRoom.mockRejectedValueOnce(new Error('NAME_TOO_LONG'));
    useRenameRoomMock.mockReturnValue({
      renameRoom,
      loading: false,
      error: '이름은 20자까지 쓸 수 있어요.',
    });
    setRoomState(readyRoom({ name: null }));
    renderWithTheme(<LogScreen />);

    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    fireEvent.changeText(screen.getByLabelText('로그 이름'), 'x');
    fireEvent.press(screen.getByLabelText('저장'));

    await waitFor(() => {
      expect(renameRoom).toHaveBeenCalled();
    });
    // 실패: 시트 유지 + 에러 메시지 표시 + refresh 미호출.
    expect(screen.getByLabelText('로그 이름')).toBeTruthy();
    expect(screen.getByText('이름은 20자까지 쓸 수 있어요.')).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('saving 중이면 저장 버튼이 로딩(비활성)이다', () => {
    useRenameRoomMock.mockReturnValue({ renameRoom, loading: true, error: null });
    setRoomState(readyRoom({ name: null }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    const save = screen.getByLabelText('저장');
    expect(save.props.accessibilityState?.disabled ?? save.props.disabled).toBeTruthy();
  });

  it('솔로(memberCount<2)면 다이얼로그에 초대코드(extra)를 노출한다 (AC2.5)', () => {
    setRoomState(readyRoom({ name: null, memberCount: 1 }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.getByLabelText('rename-extra')).toBeTruthy();
  });

  it('커플(memberCount>=2)이면 다이얼로그에 초대코드(extra)를 노출하지 않는다 (AC2.5)', () => {
    setRoomState(readyRoom({ name: null, memberCount: 2 }));
    // join-push: 커플 판정이 멤버 목록 수를 따르므로 대역을 room.memberCount 와 맞춘다(2명).
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.queryByLabelText('rename-extra')).toBeNull();
  });

  // invite-share(U72, AC13): 솔로 다이얼로그 안 카드(실 InviteCodeCard)의 두 버튼이 이 로그의 코드로 공유·복사를 부른다.
  it('솔로 다이얼로그 카드 "초대 메시지 공유" → shareInvite({ code: room.inviteCode }) 1회 (AC13)', async () => {
    setRoomState(readyRoom({ name: null, memberCount: 1 }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('초대 메시지 공유'));
    });
    expect(mockShareInvite.mock.calls).toStrictEqual([[{ code: 'ABCDEF' }]]);
    expect(mockCopyInviteCode).not.toHaveBeenCalled();
  });

  it('솔로 다이얼로그 카드 "초대코드 복사" → copyInviteCode({ code: room.inviteCode }) 1회 (AC13)', async () => {
    setRoomState(readyRoom({ name: null, memberCount: 1 }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('초대코드 복사'));
    });
    expect(mockCopyInviteCode.mock.calls).toStrictEqual([[{ code: 'ABCDEF' }]]);
    expect(mockShareInvite).not.toHaveBeenCalled();
  });

  it('다이얼로그 카드의 공유·복사는 다이얼로그를 닫지 않는다(이름 입력 유지)', async () => {
    setRoomState(readyRoom({ name: null, memberCount: 1 }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('초대 메시지 공유'));
      fireEvent.press(screen.getByLabelText('초대코드 복사'));
    });
    expect(screen.getByLabelText('로그 이름')).toBeTruthy();
  });

  it('취소하면 다이얼로그가 닫히고, 재오픈 시 현재 로그명으로 초기화한다 (AC2.6)', () => {
    setRoomState(readyRoom({ name: '우리 맛집' }));
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    fireEvent.changeText(screen.getByLabelText('로그 이름'), '바뀐값');
    fireEvent.press(screen.getByLabelText('취소'));
    expect(screen.queryByLabelText('로그 이름')).toBeNull();
    // 재오픈: 폐기된 '바뀐값'이 아니라 현재 로그명으로 draft 재초기화.
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.getByLabelText('로그 이름').props.value).toBe('우리 맛집');
  });
});

describe('LogScreen — 위시리스트 세그먼트(wishlist, TC-6/B7 · TC-1·2·4·5)', () => {
  const readyRoom = (over?: Record<string, unknown>) => ({
    status: 'ready',
    room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple', name: null, ...over },
  });
  const wishItem = (over?: Record<string, unknown>) => ({
    id: 'w1',
    roomId: 'r1',
    placeName: '성수동 베이커리',
    category: 'cafe',
    area: '성수동',
    roadAddress: '서울 성동구 연무장길 1',
    lat: 37.544,
    lng: 127.055,
    kakaoPlaceId: '12345',
    note: null,
    addedBy: 'me-uid',
    addedByMe: true,
    createdAt: '2026-06-16T10:00:00.000Z',
    ...over,
  });

  beforeEach(() => {
    setRoomState(readyRoom());
  });

  it('세그먼트에 "기록 N" / "위시리스트 M" 카운트를 표시한다 (TC-6 카운트)', () => {
    mockUseMuklogs.mockReturnValue({
      state: { status: 'ready', muklogs: [{ id: 'm1' }, { id: 'm2' }] },
      refresh: refreshMuklogs,
    });
    mockUseWishlist.mockReturnValue({
      state: { status: 'ready', items: [wishItem()] },
      refresh: refreshWishlist,
    });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('기록 2')).toBeTruthy();
    expect(screen.getByText('위시리스트 1')).toBeTruthy();
  });

  it('기본 세그는 log — MuklogList(+FAB) 마운트, WishlistView 미마운트 (TC-6 기본값)', () => {
    renderWithTheme(<LogScreen />);
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
    expect(screen.queryByLabelText('wishlist-view')).toBeNull();
  });

  it('참여자 블록은 \'log\' 세그 본문에만 렌더, \'wish\' 세그에선 미렌더한다 (I1, 킷 mk-log:79-103)', () => {
    setRoomState(readyRoom({ memberCount: 1 }));
    setMembersState({ status: 'ready', members: [memberRow('me-uid', '민지')] });
    renderWithTheme(<LogScreen />);
    // log 세그(기본): 참여자 블록 노출(세그 아래 본문 상단).
    expect(screen.getByLabelText('participant-block')).toBeTruthy();
    // wish 세그: 미렌더.
    fireEvent.press(screen.getByText('위시리스트 0'));
    expect(screen.queryByLabelText('participant-block')).toBeNull();
    // log 세그 복귀: 재노출.
    fireEvent.press(screen.getByText('기록 0'));
    expect(screen.getByLabelText('participant-block')).toBeTruthy();
  });

  it('"위시리스트" 세그 탭 → WishlistView 마운트 + MuklogList(+FAB) 언마운트(위시 세그 FAB 숨김) (TC-6/B7)', () => {
    mockUseWishlist.mockReturnValue({
      state: { status: 'ready', items: [wishItem()] },
      refresh: refreshWishlist,
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 1'));
    expect(screen.getByLabelText('wishlist-view')).toBeTruthy();
    expect(screen.queryByLabelText('muklog-list')).toBeNull();
    expect(screen.getByText('wish:성수동 베이커리')).toBeTruthy();
  });

  it('위시 세그에서 "기록" 세그로 복귀 → MuklogList 재마운트', () => {
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    expect(screen.queryByLabelText('muklog-list')).toBeNull();
    fireEvent.press(screen.getByText('기록 0'));
    expect(screen.getByLabelText('muklog-list')).toBeTruthy();
  });

  it('위시 loading이면 로더를 표시한다 (TC-1 빈/로딩)', () => {
    mockUseWishlist.mockReturnValue({ state: { status: 'loading' }, refresh: refreshWishlist });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    expect(screen.getByTestId('wishlist-loading')).toBeTruthy();
  });

  it('위시 error면 메시지 + 다시 시도 → refreshWishlist', () => {
    mockUseWishlist.mockReturnValue({
      state: { status: 'error', message: '위시리스트를 불러오지 못했어요. 다시 시도해 주세요.' },
      refresh: refreshWishlist,
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    expect(screen.getByText('위시리스트를 불러오지 못했어요. 다시 시도해 주세요.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(refreshWishlist).toHaveBeenCalled();
  });

  it('카드 ✕(삭제) → removeWishlist({id}) 후 위시 목록 refresh (TC-4)', async () => {
    mockUseWishlist.mockReturnValue({
      state: { status: 'ready', items: [wishItem({ id: 'w7' })] },
      refresh: refreshWishlist,
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 1'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('wish-remove-w7'));
    });
    expect(mockRemoveWishlist).toHaveBeenCalledWith({ id: 'w7' });
    expect(refreshWishlist).toHaveBeenCalled();
  });

  it('"다녀왔어요" → navigate(MuklogEditor, {roomId, prefill, fromWishlistId}) (TC-5/B5)', () => {
    mockUseWishlist.mockReturnValue({
      state: { status: 'ready', items: [wishItem({ id: 'w7' })] },
      refresh: refreshWishlist,
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 1'));
    fireEvent.press(screen.getByLabelText('wish-visit-w7'));
    expect(mockNavigate).toHaveBeenCalledWith('MuklogEditor', {
      roomId: 'r1',
      prefill: {
        placeName: '성수동 베이커리',
        category: 'cafe',
        area: '성수동',
        roadAddress: '서울 성동구 연무장길 1',
        lat: 37.544,
        lng: 127.055,
        kakaoPlaceId: '12345',
      },
      fromWishlistId: 'w7',
    });
  });

  // ── 전환 중 재탭 가드(wishlist-visit-double-tap · U67) ──────────────────────────────────────
  //   seam = 위시 행 "기록하기" 누름(WishlistView probe의 onVisit({ id })) → navigate 호출 인자·횟수 + isFocused 더블.
  //   에디터는 프리필을 처음 열릴 때 한 번만 읽고 같은 이름 navigate는 params만 바꾸므로, 전환 중 다른 행이 실리면
  //   화면의 가게(첫 위시)와 저장 뒤 지워지는 위시(두 번째)가 어긋난다. 인자는 toEqual로 정확 일치(여분 키 누설도 잡는다).
  describe('전환 중 재탭(U67, 원칙 3·9)', () => {
    const W7_EDITOR_PARAMS = {
      roomId: 'r1',
      prefill: {
        placeName: '성수동 베이커리',
        category: 'cafe',
        area: '성수동',
        roadAddress: '서울 성동구 연무장길 1',
        lat: 37.544,
        lng: 127.055,
        kakaoPlaceId: '12345',
      },
      fromWishlistId: 'w7',
    };
    // 두 번째 위시는 7필드가 전부 w7과 다르다 — 어느 필드가 섞여도 정확 일치 비교에서 드러난다.
    const w8Item = () =>
      wishItem({
        id: 'w8',
        placeName: '연남 칼국수',
        category: 'noodle',
        area: '연남동',
        roadAddress: '서울 마포구 동교로 2',
        lat: 37.561,
        lng: 126.925,
        kakaoPlaceId: '67890',
      });
    const W8_EDITOR_PARAMS = {
      roomId: 'r1',
      prefill: {
        placeName: '연남 칼국수',
        category: 'noodle',
        area: '연남동',
        roadAddress: '서울 마포구 동교로 2',
        lat: 37.561,
        lng: 126.925,
        kakaoPlaceId: '67890',
      },
      fromWishlistId: 'w8',
    };

    const openWishSegment = ({ items }: { items: unknown[] }) => {
      mockUseWishlist.mockReturnValue({ state: { status: 'ready', items }, refresh: refreshWishlist });
      renderWithTheme(<LogScreen />);
      fireEvent.press(screen.getByText(`위시리스트 ${items.length}`));
    };

    /**
     * 에디터에서 돌아옴(‹·가장자리 스와이프) — 로그 화면이 다시 스택 맨 위(isFocused true) + navigate의 blur로 쉬던
     * 포커스 효과 재발화. 떠날 때는 blur 정리 함수가 이미 불렸다(beforeEach의 navigate 흉내).
     */
    const returnToLogScreen = () => {
      act(() => {
        focusLogScreen();
      });
    };

    it('LV1 같은 행 "기록하기" 연타 — 두 번째는 로그 화면이 이미 포커스를 잃은 뒤라 무시되고 이동은 1회다', () => {
      openWishSegment({ items: [wishItem({ id: 'w7' })] });

      fireEvent.press(screen.getByLabelText('wish-visit-w7'));
      fireEvent.press(screen.getByLabelText('wish-visit-w7'));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate.mock.calls).toEqual([['MuklogEditor', W7_EDITOR_PARAMS]]);
    });

    it('LV2 에디터로 넘어가는 중 다른 행 "기록하기" — 무시해서 첫 위시(w7)만 실리고, 삭제·재조회·토스트 없이 조용하다', () => {
      openWishSegment({ items: [wishItem({ id: 'w7' }), w8Item()] });
      const wishRefreshBefore = refreshWishlist.mock.calls.length;

      fireEvent.press(screen.getByLabelText('wish-visit-w7'));
      fireEvent.press(screen.getByLabelText('wish-visit-w8'));

      // 더블에 push가 없어서 push로 바꾼 구현은 여기까지 오지 못하고 TypeError로 실패한다.
      expect(mockNavigate.mock.calls).toEqual([['MuklogEditor', W7_EDITOR_PARAMS]]);
      expect(mockRemoveWishlist).not.toHaveBeenCalled();
      expect(refreshWishlist.mock.calls.length).toBe(wishRefreshBefore);
      expect(screen.queryByTestId('toast-pill')).toBeNull();
    });

    it('LV3 에디터에서 돌아오면 가드가 풀려 다른 행을 누를 수 있다 — 잠금이 아니라 누르는 순간의 포커스 읽기다', () => {
      openWishSegment({ items: [wishItem({ id: 'w7' }), w8Item()] });
      fireEvent.press(screen.getByLabelText('wish-visit-w7'));
      fireEvent.press(screen.getByLabelText('wish-visit-w8'));

      returnToLogScreen();
      // 떠날 때(blur 정리 함수) 세그·검색뷰를 바꾸지 않아서, 돌아오면 떠나기 전의 위시 목록이 그대로 보인다.
      expect(screen.getByLabelText('wishlist-view')).toBeTruthy();
      expect(screen.queryByLabelText('place-search')).toBeNull();
      fireEvent.press(screen.getByLabelText('wish-visit-w8'));

      expect(mockNavigate.mock.calls).toEqual([
        ['MuklogEditor', W7_EDITOR_PARAMS],
        ['MuklogEditor', W8_EDITOR_PARAMS],
      ]);
    });
  });

  it('"추가" → PlaceSearchView 풀스크린 스왑(검색뷰 표시)', () => {
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    expect(screen.getByLabelText('place-search')).toBeTruthy();
  });

  it('검색 결과 선택 → addWishlist(매핑 AddWishlistInput) + refresh + 검색뷰 복귀 (TC-2/B8)', async () => {
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('search-pick'));
    });
    expect(mockAddWishlist).toHaveBeenCalledWith({
      input: {
        roomId: 'r1',
        placeName: '성수동 베이커리',
        category: 'cafe',
        area: '성수동',
        roadAddress: '서울 성동구 연무장길 1',
        lat: 37.544,
        lng: 127.055,
        kakaoPlaceId: '12345',
      },
    });
    expect(refreshWishlist).toHaveBeenCalled();
    expect(screen.queryByLabelText('place-search')).toBeNull();
    // 토스트 "위시리스트에 담았어요 📍"(킷 mk-log:33) 노출.
    expect(screen.getByText('위시리스트에 담았어요 📍')).toBeTruthy();
  });

  it('M4: 이미 담은 장소(중복) 선택 → addWishlist 미호출 + "이미 담은 곳이에요" 안내 + 검색뷰 복귀', async () => {
    mockWishlistExists.mockResolvedValue(true);
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('search-pick'));
    });
    expect(mockWishlistExists).toHaveBeenCalledWith({ roomId: 'r1', kakaoPlaceId: '12345' });
    expect(mockAddWishlist).not.toHaveBeenCalled();
    expect(screen.getByText('이미 담은 곳이에요')).toBeTruthy();
    expect(screen.queryByLabelText('place-search')).toBeNull();
  });

  it('M4: 검색 결과 연타 → in-flight 가드로 addWishlist가 1회만 호출된다', async () => {
    let resolveAdd: (v: { id: string }) => void = () => {};
    mockAddWishlist.mockImplementation(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveAdd = resolve;
        }),
    );
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    await act(async () => {
      // 첫 탭 → insert in-flight, 둘째 탭은 가드로 무시.
      fireEvent.press(screen.getByLabelText('search-pick'));
      fireEvent.press(screen.getByLabelText('search-pick'));
    });
    await act(async () => {
      resolveAdd({ id: 'w-new' });
    });
    expect(mockAddWishlist).toHaveBeenCalledTimes(1);
  });

  it('직접 입력(0건 폴백) → 검색어를 placeName으로 addWishlist(좌표 null)', async () => {
    mockUsePlaceSearch.mockReturnValue({
      query: '노포국밥',
      setQuery: jest.fn(),
      status: 'ready',
      results: [],
      errorMessage: null,
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('search-manual'));
    });
    expect(mockAddWishlist).toHaveBeenCalledWith({
      input: {
        roomId: 'r1',
        placeName: '노포국밥',
        category: null,
        area: null,
        roadAddress: null,
        lat: null,
        lng: null,
        kakaoPlaceId: null,
      },
    });
  });

  it('검색 취소(뒤로) → 추가 없이 위시 세그 복귀', () => {
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
    fireEvent.press(screen.getByLabelText('search-back'));
    expect(screen.queryByLabelText('place-search')).toBeNull();
    expect(mockAddWishlist).not.toHaveBeenCalled();
  });

  // ── U6 실패 피드백(silent-failure-feedback T3~T7) ──────────────────────────────────────
  //   seam = 화면(토스트 문구·검색뷰 존재·진행 문구) + addWishlist 호출 횟수. 내부 ref/setState는 보지 않는다.
  //   ⚠️ 기존 성공/중복/연타/직접입력 케이스(:832·:857·:871·:893)는 손대지 않는다 — 그것이 회귀 0 가드다(T7).
  describe('위시 추가 실패 피드백(U6, 원칙 3·10)', () => {
    // 실패 문구 = mapWishlistError 기본값. 지도 담기(useAddNearbyWish.ts:70)와 동일 문구여야 한다.
    const FAIL_MESSAGE = '위시리스트 처리에 실패했어요. 다시 시도해 주세요.';

    const openSearch = () => {
      renderWithTheme(<LogScreen />);
      fireEvent.press(screen.getByText('위시리스트 0'));
      fireEvent.press(screen.getByLabelText('wish-add'));
    };

    it('T3 — insert 실패 시 mapWishlistError 토스트를 표시하고 성공 토스트는 뜨지 않는다', async () => {
      mockAddWishlist.mockRejectedValueOnce(new Error('network down'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(await screen.findByText(FAIL_MESSAGE)).toBeTruthy();
      expect(screen.queryByText('위시리스트에 담았어요 📍')).toBeNull();
    });

    it('T3 — 에러 토큰이 있으면 매핑된 문구를 쓴다(NOT_AUTHENTICATED)', async () => {
      mockAddWishlist.mockRejectedValueOnce(new Error('NOT_AUTHENTICATED'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(await screen.findByText('로그인이 필요해요. 다시 로그인해 주세요.')).toBeTruthy();
    });

    it('T4 — 중복 pre-check 실패도 같은 토스트 + addWishlist 미호출', async () => {
      mockWishlistExists.mockRejectedValueOnce(new Error('network down'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(await screen.findByText(FAIL_MESSAGE)).toBeTruthy();
      expect(mockAddWishlist).not.toHaveBeenCalled();
    });

    it('T4 — "직접 입력" 경로 실패도 같은 토스트', async () => {
      mockUsePlaceSearch.mockReturnValue({
        query: '노포국밥',
        setQuery: jest.fn(),
        status: 'ready',
        results: [],
        errorMessage: null,
      });
      mockAddWishlist.mockRejectedValueOnce(new Error('network down'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-manual'));
      });
      expect(await screen.findByText(FAIL_MESSAGE)).toBeTruthy();
    });

    it('T5 — 실패해도 검색뷰가 유지되고, 같은 행 재탭이 addWishlist를 2번째로 호출한다(복구 경로)', async () => {
      mockAddWishlist.mockRejectedValueOnce(new Error('network down'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      // D2: 실패 시 닫지 않는다 — 재시도가 재검색부터가 되지 않게(원칙 10).
      expect(screen.getByLabelText('place-search')).toBeTruthy();
      // 가드(ref)가 영구 잠기지 않는다 — finally에서 풀린다.
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(mockAddWishlist).toHaveBeenCalledTimes(2);
    });

    it('T5 — 실패 후 재시도가 성공하면 성공 토스트로 대체되고 검색뷰가 닫힌다(§5-1 케이스 5)', async () => {
      mockAddWishlist.mockRejectedValueOnce(new Error('network down'));
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(await screen.findByText(FAIL_MESSAGE)).toBeTruthy();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      // 토스트는 큐가 없다 — 마지막 호출만 보인다.
      expect(await screen.findByText('위시리스트에 담았어요 📍')).toBeTruthy();
      expect(screen.queryByText(FAIL_MESSAGE)).toBeNull();
      expect(screen.queryByLabelText('place-search')).toBeNull();
    });

    it('T6 — 제출 중에는 "담는 중…"이 보이고, 완료 후 사라진다', async () => {
      let resolveAdd: (v: { id: string }) => void = () => {};
      mockAddWishlist.mockImplementation(
        () =>
          new Promise<{ id: string }>((resolve) => {
            resolveAdd = resolve;
          }),
      );
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(screen.getByText('담는 중…')).toBeTruthy();
      await act(async () => {
        resolveAdd({ id: 'w-new' });
      });
      await waitFor(() => expect(screen.queryByText('담는 중…')).toBeNull());
    });

    it('T6 — 실패로 끝나도 "담는 중…"이 사라진다(검색뷰는 유지)', async () => {
      let rejectAdd: (e: Error) => void = () => {};
      mockAddWishlist.mockImplementation(
        () =>
          new Promise<{ id: string }>((_resolve, reject) => {
            rejectAdd = reject;
          }),
      );
      openSearch();
      await act(async () => {
        fireEvent.press(screen.getByLabelText('search-pick'));
      });
      expect(screen.getByText('담는 중…')).toBeTruthy();
      await act(async () => {
        rejectAdd(new Error('network down'));
      });
      await waitFor(() => expect(screen.queryByText('담는 중…')).toBeNull());
      expect(screen.getByLabelText('place-search')).toBeTruthy();
    });
  });

  it('재포커스(에디터/상세 복귀) 시 먹로그·위시·멤버 목록을 함께 refresh (다녀왔어요/삭제/합류 반영, 폴링 아님)', () => {
    renderWithTheme(<LogScreen />);
    // 첫 포커스(마운트)는 가드 → refresh 미호출.
    expect(refreshMuklogs).not.toHaveBeenCalled();
    expect(refreshWishlist).not.toHaveBeenCalled();
    expect(membersRefresh).not.toHaveBeenCalled();
    act(() => {
      refireFocus();
    });
    expect(refreshMuklogs).toHaveBeenCalledTimes(1);
    expect(refreshWishlist).toHaveBeenCalledTimes(1);
    // join-push(AC21): 멤버 목록도 포커스당 1회(참여자 블록·커플 판정이 새 멤버를 반영).
    expect(membersRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('LogScreen — room-lifecycle 나가기/예약삭제 배선 (T9~T11)', () => {
  const readyCouple = (over?: Record<string, unknown>) => ({
    status: 'ready',
    room: {
      roomId: 'r1',
      inviteCode: 'ABCDEF',
      memberCount: 2,
      mode: 'couple',
      name: null,
      deleteScheduledAt: null,
      deleteRequestedBy: null,
      ...over,
    },
  });
  const readySolo = (over?: Record<string, unknown>) => ({
    status: 'ready',
    room: {
      roomId: 'r1',
      inviteCode: 'ABCDEF',
      memberCount: 1,
      mode: 'couple',
      name: null,
      deleteScheduledAt: null,
      deleteRequestedBy: null,
      ...over,
    },
  });
  // probe Text(단일 문자열 children)에서 직렬화된 props 문자열을 읽는다.
  const sheetsText = (): string => screen.getByText(/^menu:/).props.children as string;
  const bannerText = (): string => screen.getByText(/^requester:/).props.children as string;

  // ── T9: ⋯ 메뉴 + 확인 시트 분기 ──────────────────────────────────────────
  it('헤더 ⋯ 버튼 탭 → 나가기 메뉴 시트가 열린다 (menuVisible=true)', () => {
    setRoomState(readyCouple());
    renderWithTheme(<LogScreen />);
    expect(sheetsText()).toContain('menu:false');
    fireEvent.press(screen.getByLabelText('더보기'));
    expect(sheetsText()).toContain('menu:true');
  });

  it('메뉴 "로그 나가기"(probe-select-leave) → 메뉴 닫고 확인 시트 open', () => {
    setRoomState(readyCouple());
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-leave'));
    const t = sheetsText();
    expect(t).toContain('menu:false');
    expect(t).toContain('confirm:true');
  });

  it('커플(memberCount>=2)이면 isCouple=true 로 시트에 전달한다 (24h 유예 카피 분기 근거)', () => {
    setRoomState(readyCouple());
    // join-push: 커플 판정이 멤버 목록 수를 따르므로 대역을 room.memberCount 와 맞춘다(2명).
    setMembersState({
      status: 'ready',
      members: [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')],
    });
    renderWithTheme(<LogScreen />);
    expect(sheetsText()).toContain('couple:true');
  });

  it('솔로(memberCount=1)이면 isCouple=false 로 전달한다 (즉시 삭제 카피 분기 근거)', () => {
    setRoomState(readySolo());
    renderWithTheme(<LogScreen />);
    expect(sheetsText()).toContain('couple:false');
  });

  // ── T10: 나가기 액션 배선 ─────────────────────────────────────────────────
  it('커플 나가기 확인 → leaveRoom({roomId}) 호출, scheduled 성공 시 확인 닫고 refresh(배너 표시)·goBack 안 함', async () => {
    setRoomState(readyCouple());
    mockLeaveRoom.mockResolvedValue({
      scheduled: true,
      roomDeleted: false,
      deleteScheduledAt: '2026-06-17T00:00:00.000Z',
      roomId: 'r1',
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-leave'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-confirm-leave'));
    });
    expect(mockLeaveRoom).toHaveBeenCalledWith({ roomId: 'r1' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(sheetsText()).toContain('confirm:false');
    // SPEC §4-1 커플 나가기 성공 토스트(전역, positive).
    await waitFor(() =>
      expect(screen.getByText('로그에서 나갔어요 · 24시간 뒤 삭제돼요')).toBeTruthy(),
    );
  });

  it('솔로 삭제 확인 → roomDeleted 성공 시 goBack 호출(목록 복귀)', async () => {
    setRoomState(readySolo());
    mockLeaveRoom.mockResolvedValue({
      scheduled: false,
      roomDeleted: true,
      deleteScheduledAt: null,
      roomId: 'r1',
    });
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-leave'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-confirm-leave'));
    });
    expect(mockLeaveRoom).toHaveBeenCalledWith({ roomId: 'r1' });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    // SPEC §4-1 솔로 삭제 성공 토스트(전역, positive). goBack 후에도 전역이라 유지.
    await waitFor(() => expect(screen.getByText('로그를 삭제했어요')).toBeTruthy());
  });

  it('나가기 실패(reject) → goBack·refresh 안 하고 확인 시트 유지(leaveError 인라인)', async () => {
    setRoomState(readyCouple());
    mockLeaveRoom.mockRejectedValue(new Error('NOT_AUTHENTICATED'));
    mockLeaveHookState.error = '세션이 만료됐어요. 앱을 다시 시작해 주세요.';
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-leave'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-confirm-leave'));
    });
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    const t = sheetsText();
    expect(t).toContain('confirm:true');
    expect(t).toContain('세션이 만료됐어요');
    // 실패 시 성공 토스트 미노출(SPEC §4-1 — 성공 경로 전용).
    expect(screen.queryByText('로그에서 나갔어요 · 24시간 뒤 삭제돼요')).toBeNull();
  });

  it('leaving(useLeaveRoom.loading) 상태를 시트에 전달한다', () => {
    setRoomState(readyCouple());
    mockLeaveHookState.loading = true;
    renderWithTheme(<LogScreen />);
    expect(sheetsText()).toContain('leaving:true');
  });

  // ── T11: 예약삭제 배너 + 취소 ─────────────────────────────────────────────
  it('deleteScheduledAt가 null이면 예약삭제 배너를 렌더하지 않는다 (게이팅)', () => {
    setRoomState(readyCouple({ deleteScheduledAt: null }));
    renderWithTheme(<LogScreen />);
    expect(screen.queryByLabelText('scheduled-deletion-banner')).toBeNull();
  });

  it('deleteScheduledAt가 있으면 배너 렌더 + 요청자(meId==deleteRequestedBy)면 isRequester=true', () => {
    setRoomState(
      readyCouple({ deleteScheduledAt: '2026-06-17T00:00:00.000Z', deleteRequestedBy: 'me-uid' }),
    );
    renderWithTheme(<LogScreen />);
    expect(screen.getByLabelText('scheduled-deletion-banner')).toBeTruthy();
    expect(bannerText()).toContain('requester:true');
  });

  it('상대가 요청자면(meId != deleteRequestedBy) isRequester=false (취소 버튼 미노출 근거·이중 방어)', () => {
    setRoomState(
      readyCouple({ deleteScheduledAt: '2026-06-17T00:00:00.000Z', deleteRequestedBy: 'partner-uid' }),
    );
    renderWithTheme(<LogScreen />);
    expect(bannerText()).toContain('requester:false');
  });

  it('배너 "삭제 취소"(probe-cancel-deletion) → cancelRoomDeletion({roomId}) 호출 후 refresh(배너 사라짐)', async () => {
    setRoomState(
      readyCouple({ deleteScheduledAt: '2026-06-17T00:00:00.000Z', deleteRequestedBy: 'me-uid' }),
    );
    mockCancelRoomDeletion.mockResolvedValue({ canceled: true, roomId: 'r1' });
    renderWithTheme(<LogScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-cancel-deletion'));
    });
    expect(mockCancelRoomDeletion).toHaveBeenCalledWith({ roomId: 'r1' });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('취소 실패(reject·NOT_SCHEDULED) → 한국어 토스트 노출 + refresh로 상태 reconcile', async () => {
    setRoomState(
      readyCouple({ deleteScheduledAt: '2026-06-17T00:00:00.000Z', deleteRequestedBy: 'me-uid' }),
    );
    mockCancelRoomDeletion.mockRejectedValue(new Error('NOT_SCHEDULED'));
    renderWithTheme(<LogScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('probe-cancel-deletion'));
    });
    await waitFor(() =>
      expect(screen.getByText('이미 삭제 예약이 해제됐거나 없는 로그예요.')).toBeTruthy(),
    );
    expect(refresh).toHaveBeenCalled();
  });
});

// ── 합류 알림 → 로그 화면 멤버 갱신(join-push U74 · plan AC21·AC22 · R8) ─────────────────────────────
//   seam = 화면이 쓰는 멤버 refresh 호출 횟수(재포커스·같은 화면 알림 탭) + 나가기 시트 couple 값 + 이름 변경 다이얼로그.
//   같은 로그 화면이 맨 위일 때 알림을 누르면 React Navigation 은 params(pushTapAt)만 바꾼다 — rerender 로 흉내 낸다.
describe('LogScreen — 합류 알림 멤버 갱신(join-push U74)', () => {
  const readyRoom = (over?: Record<string, unknown>) => ({
    status: 'ready',
    room: {
      roomId: 'r1',
      inviteCode: 'ABCDEF',
      memberCount: 1,
      mode: 'couple',
      name: null,
      deleteScheduledAt: null,
      deleteRequestedBy: null,
      ...over,
    },
  });
  const twoMembers = [memberRow('me-uid', '민지'), memberRow('p-uid', '지현')];
  // 나가기 시트 probe 문자열에서 couple 값만 정확히 꺼낸다(다른 필드가 대신 만족시키지 못하게).
  const coupleValue = (): string | undefined =>
    /\|couple:(true|false)\|/.exec(screen.getByText(/^menu:/).props.children as string)?.[1];

  it('AC21: 재포커스마다 멤버 refresh 1회씩(첫 포커스 = 마운트 조회와 겹쳐 0)', () => {
    setRoomState(readyRoom());
    renderWithTheme(<LogScreen />);
    expect(membersRefresh).not.toHaveBeenCalled();
    act(() => {
      refireFocus();
    });
    expect(membersRefresh).toHaveBeenCalledTimes(1);
    act(() => {
      refireFocus();
    });
    expect(membersRefresh).toHaveBeenCalledTimes(2);
    // plan D6-3: get_room(useRoom 의 refresh)은 재포커스 때 다시 부르지 않는다 — 실패하면 화면 전체가 ErrorRetryView 로 바뀐다.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('AC21: 같은 로그 화면에서 알림 탭(params.pushTapAt 새 값) → 멤버만 1회 다시 불러온다', () => {
    setRoomState(readyRoom());
    mockParams.current = { roomId: 'r1' };
    const { rerender } = renderWithTheme(<LogScreen />);
    expect(membersRefresh).not.toHaveBeenCalled();

    mockParams.current = { roomId: 'r1', pushTapAt: 111 };
    rerender(<LogScreen />);
    expect(membersRefresh).toHaveBeenCalledTimes(1);
    // 비용 상한: 알림 탭 1번 = 멤버 조회 1번(기록·위시·get_room 은 다시 부르지 않는다 — plan D6-3).
    expect(refreshMuklogs).not.toHaveBeenCalled();
    expect(refreshWishlist).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();

    // 같은 값으로 다시 렌더 → 그대로 1회. 새 탭 → 1회 더.
    rerender(<LogScreen />);
    expect(membersRefresh).toHaveBeenCalledTimes(1);
    mockParams.current = { roomId: 'r1', pushTapAt: 222 };
    rerender(<LogScreen />);
    expect(membersRefresh).toHaveBeenCalledTimes(2);
  });

  it('AC21: pushTapAt 을 안고 마운트하면(콜드스타트·새로 쌓임) 멤버 refresh 0 — 마운트 조회가 이미 있다', () => {
    setRoomState(readyRoom());
    mockParams.current = { roomId: 'r1', pushTapAt: 111 };
    renderWithTheme(<LogScreen />);
    expect(membersRefresh).not.toHaveBeenCalled();
  });

  // QA F-S1: 화면이 훅에 실제 roomId 를 넘기는지(상수·빈 값이면 다른 로그 알림 탭 1번에 멤버 조회가 2번이 된다 — AC20 상한).
  it('AC20·AC21: 다른 로그 알림 탭(roomId·pushTapAt 함께 바뀜) → 멤버 refresh 0(roomId 재조회가 이미 있다)', () => {
    setRoomState(readyRoom());
    mockParams.current = { roomId: 'r1' };
    const { rerender } = renderWithTheme(<LogScreen />);
    mockParams.current = { roomId: 'r2', pushTapAt: 111 };
    rerender(<LogScreen />);
    expect(membersRefresh).not.toHaveBeenCalled();

    // 바뀐 로그(r2)에서 다시 알림을 누르면 그때는 1회 — 훅이 꺼진 것이 아니라 roomId 를 보고 건너뛴 것이다.
    mockParams.current = { roomId: 'r2', pushTapAt: 222 };
    rerender(<LogScreen />);
    expect(membersRefresh).toHaveBeenCalledTimes(1);
  });

  it('AC22: room.memberCount 가 1 이어도 멤버 2명이 준비되면 커플로 판단한다(나가기 시트·다이얼로그 카드·이름 폴백)', () => {
    setRoomState(readyRoom({ memberCount: 1 }));
    setMembersState({ status: 'ready', members: twoMembers });
    renderWithTheme(<LogScreen />);
    expect(coupleValue()).toBe('true');

    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.queryByLabelText('rename-extra')).toBeNull();
    // 이름 폴백(placeholder)도 같은 멤버 수 — 2명 기준 "{닉} · 짝꿍".
    expect(screen.getByLabelText('로그 이름').props.placeholder).toBe('민지 · 짝꿍');
  });

  it('AC22: room.memberCount 가 2 여도 멤버 목록이 1명으로 준비되면 솔로로 판단한다(멤버 목록 우선)', () => {
    setRoomState(readyRoom({ memberCount: 2 }));
    setMembersState({ status: 'ready', members: [memberRow('me-uid', '민지')] });
    renderWithTheme(<LogScreen />);
    expect(coupleValue()).toBe('false');
  });

  it('AC22: 멤버가 error 면 room.memberCount 로 돌아간다(2 → 커플)', () => {
    setRoomState(readyRoom({ memberCount: 2 }));
    setMembersState({ status: 'error', message: '연결에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<LogScreen />);
    expect(coupleValue()).toBe('true');
  });

  it('AC22: 멤버가 loading 이면 room.memberCount 로 판단한다(1 → 솔로, 다이얼로그 카드 있음)', () => {
    setRoomState(readyRoom({ memberCount: 1 }));
    setMembersState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(coupleValue()).toBe('false');
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.getByLabelText('rename-extra')).toBeTruthy();
  });

  // QA F-S2: 위 1명 케이스만으로는 "loading 이면 0명" 구현도 같은 답(솔로)을 낸다 — 2명으로 갈래를 잠근다.
  //   틀어지면 커플 로그의 나가기 시트가 솔로 문구(즉시 삭제)를 보인다(서버는 24시간 뒤 삭제 예약).
  it('AC22: 멤버가 loading 이고 room.memberCount 가 2 면 커플로 판단한다(다이얼로그 카드 없음·이름 폴백 2명 꼴)', () => {
    setRoomState(readyRoom({ memberCount: 2 }));
    setMembersState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(coupleValue()).toBe('true');
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.queryByLabelText('rename-extra')).toBeNull();
    expect(screen.getByLabelText('로그 이름').props.placeholder).toBe('민지 · 짝꿍');
  });

  // ── join-push V3(리더 결정 2026-10-01) — 멤버 재조회가 실패해도 이미 보이던 화면을 바꾸지 않는다 ─────────────
  //   ① 한 번도 멤버를 불러오지 못했으면(loading·error) 제목은 get_room memberCount 기반 폴백(홈 카드와 같은 displayLogName 꼴).
  //   ② 이미 ready 였으면 재조회가 실패해도 직전 목록 유지 — 제목·참여자 블록·나가기 시트 판정이 같은 목록을 따른다.
  it('V3: 멤버 첫 조회가 실패하면(error) 제목은 room.memberCount 기반 폴백 — 2명이면 "{닉} · 짝꿍"(솔로 꼴 아님)', () => {
    setRoomState(readyRoom({ memberCount: 2 }));
    setMembersState({ status: 'error', message: '연결에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('민지 · 짝꿍')).toBeTruthy();
    expect(screen.queryByText('민지의 기록')).toBeNull();
    expect(screen.queryByLabelText('participant-block')).toBeNull();
  });

  it('V3: 멤버를 아직 불러오는 중(loading)이어도 같은 폴백 — 2명이면 "{닉} · 짝꿍"', () => {
    setRoomState(readyRoom({ memberCount: 2 }));
    setMembersState({ status: 'loading' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('민지 · 짝꿍')).toBeTruthy();
  });

  it('V3: 멤버를 불러오지 못해도 로그 이름이 있으면 그 이름이 제목이다', () => {
    setRoomState(readyRoom({ memberCount: 2, name: '을지로 투어' }));
    setMembersState({ status: 'error', message: '연결에 실패했어요. 다시 시도해 주세요.' });
    renderWithTheme(<LogScreen />);
    expect(screen.getByText('을지로 투어')).toBeTruthy();
    expect(screen.queryByText('민지 · 짝꿍')).toBeNull();
  });

  // 실제 useRoomMembers(+ useOneShotQuery keepLastReady)를 쓰고 외부 SDK 경계(supabase.rpc)만 대역으로 둔다.
  //   훅 대역이 상태를 정하면 화면은 무엇이든 통과하므로, "재조회 실패 → 직전 목록 유지"는 실제 훅이 하중을 지는 이 테스트로 본다.
  it('V3: 재포커스 재조회가 실패해도 참여자 블록·제목·나가기 시트 판정이 그대로다(실제 멤버 훅 — rpc 만 대역)', async () => {
    const rpcMock = supabase.rpc as jest.Mock;
    rpcMock.mockReset();
    const { useRoomMembers: actualUseRoomMembers } = jest.requireActual(
      '@/features/room/useRoomMembers',
    );
    useRoomMembersMock.mockImplementation(actualUseRoomMembers);
    // 합류 알림을 눌러 들어온 직후처럼: get_room 은 아직 1명(마운트 때 값), 멤버 목록은 2명.
    setRoomState(readyRoom({ memberCount: 1 }));
    rpcMock.mockResolvedValueOnce({
      data: [
        { user_id: 'me-uid', nickname: '민지', avatar_url: null },
        { user_id: 'p-uid', nickname: '지현', avatar_url: null },
      ],
      error: null,
    });
    renderWithTheme(<LogScreen />);
    expect(await screen.findByText('참여자 2|canInvite:true|meId:me-uid')).toBeTruthy();
    expect(screen.getByText('민지 · 지현')).toBeTruthy();
    expect(coupleValue()).toBe('true');

    // 재포커스 → 멤버 재조회 1회가 실패한다(신호 약한 곳에서 상세에 다녀옴 등).
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('NETWORK') });
    act(() => {
      refireFocus();
    });
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
    // 실패 응답이 훅에 도착할 때까지 한 틱 정착시킨다(useCachedQuery.spec H8 과 같은 방식).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByText('참여자 2|canInvite:true|meId:me-uid')).toBeTruthy();
    expect(screen.getByText('민지 · 지현')).toBeTruthy();
    expect(coupleValue()).toBe('true');
    expect(rpcMock.mock.calls).toEqual([
      ['list_room_members', { p_room_id: 'r1' }],
      ['list_room_members', { p_room_id: 'r1' }],
    ]);
  });
});

// ── 위시 장소검색 스왑 전환(motion-coverage D1 / plan §5-1 A) ──────────────────────────────
//   seam = 사용자 가시 동작(접근성 라벨) + SWAP_TRANSITION_TEST_ID 래퍼의 렌더 시점 opacity.
//   Animated 궤적·중간 프레임·duration 값은 검증하지 않는다(plan §5-2).
describe('LogScreen — 위시 검색 스왑 전환(motion-coverage D1, 백로그 U30/원칙 4)', () => {
  const readyRoom = () => ({
    status: 'ready' as const,
    room: { roomId: 'r1', inviteCode: 'ABCDEF', memberCount: 1, mode: 'couple', name: null },
  });

  // 래퍼의 렌더 시점 불투명도 — 1이면 무애니(정착), 1 미만이면 진입 전환이 재생 중이다.
  const wrapperOpacity = () =>
    (StyleSheet.flatten(screen.getByTestId(SWAP_TRANSITION_TEST_ID).props.style) as Record<string, unknown>)
      .opacity as number;

  const openSearch = () => {
    fireEvent.press(screen.getByText('위시리스트 0'));
    fireEvent.press(screen.getByLabelText('wish-add'));
  };

  beforeEach(() => {
    setRoomState(readyRoom());
  });

  it('A-1: 최초 마운트(기록 세그)에서는 전환이 재생되지 않는다(무애니)', () => {
    renderWithTheme(<LogScreen />);
    expect(screen.getByTestId(SWAP_TRANSITION_TEST_ID)).toBeTruthy();
    expect(wrapperOpacity()).toBe(1);
  });

  it('A-2: 위시 "추가" → 검색뷰가 래퍼를 유지한 채(리마운트 아님) 진입 전환을 재생한다', () => {
    renderWithTheme(<LogScreen />);
    openSearch();
    expect(screen.getByLabelText('place-search')).toBeTruthy();
    // 래퍼가 언마운트/리마운트되면 최초 마운트 규칙으로 1이 나온다 — 이 단언이 조기 반환→삼항 전환의 핵심 가드.
    expect(wrapperOpacity()).toBeLessThan(1);
  });

  it('A-3: "검색 취소" → 메인 복귀 + 복귀 전환 재생', () => {
    renderWithTheme(<LogScreen />);
    openSearch();
    fireEvent.press(screen.getByLabelText('search-back'));
    expect(screen.queryByLabelText('place-search')).toBeNull();
    expect(wrapperOpacity()).toBeLessThan(1);
  });

  it('A-4: 전환 직후 즉시 결과 선택이 가능하고 위시 추가 계약이 그대로다(회귀 0)', async () => {
    renderWithTheme(<LogScreen />);
    openSearch();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('search-pick'));
    });
    expect(mockAddWishlist).toHaveBeenCalledTimes(1);
    expect(mockAddWishlist).toHaveBeenCalledWith({
      input: {
        roomId: 'r1',
        placeName: '성수동 베이커리',
        category: 'cafe',
        area: '성수동',
        roadAddress: '서울 성동구 연무장길 1',
        lat: 37.544,
        lng: 127.055,
        kakaoPlaceId: '12345',
      },
    });
    expect(refreshWishlist).toHaveBeenCalled();
    expect(screen.getByText('위시리스트에 담았어요 📍')).toBeTruthy();
  });

  // AC⑤는 loading·error·roomId 없음 3분기 전부 "전환 래퍼 미렌더"를 요구한다(상위 조기 반환 유지).
  it.each([
    [
      'error',
      () => setRoomState({ status: 'error', message: '이 로그에 접근할 권한이 없어요.' }),
      () => expect(screen.getByText('이 로그에 접근할 권한이 없어요.')).toBeTruthy(),
    ],
    [
      'loading',
      () => setRoomState({ status: 'loading' }),
      () => expect(screen.getByTestId('logscreen-loading')).toBeTruthy(),
    ],
    [
      'roomId 없음',
      () => {
        mockParams.current = {};
        setRoomState({ status: 'loading' });
      },
      () => expect(screen.getByText('로그를 찾을 수 없어요')).toBeTruthy(),
    ],
  ])('A-5: %s 분기는 전환 래퍼 없이 기존 뷰만 렌더한다(상위 조기 반환 유지)', (_name, setup, expectView) => {
    setup();
    renderWithTheme(<LogScreen />);
    expect(screen.queryByTestId(SWAP_TRANSITION_TEST_ID)).toBeNull();
    expectView();
  });
});
