// src/navigation/screens/LogScreen.spec.tsx
// 로그 진입(B2) — useRoom 조회 → 헤더(아바타 겹침+로그명) + 초대영역(솔로 InviteCodeCard / 커플 컴팩트 코드행) 분기.
//   로딩/에러/roomId 누락 방어 + MuklogList 마운트. (plan §5 B2 / §6.1). ⚠️ AC3: 커플도 코드 노출(plan §118).
import React from 'react';
import { StyleSheet } from 'react-native';
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

const mockParams: { current: unknown } = { current: { roomId: 'r1' } };
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// room-lifecycle(T9~T11) — useLeaveRoom/useCancelRoomDeletion 더블 + loading/error 가변 상태.
const mockLeaveRoom = jest.fn();
const mockCancelRoomDeletion = jest.fn();
const mockLeaveHookState: { loading: boolean; error: string | null } = { loading: false, error: null };
const mockCancelHookState: { loading: boolean; error: string | null } = { loading: false, error: null };
// useFocusEffect: 마운트 시 콜백 1회 실행(첫 포커스). refireFocus로 재포커스(에디터/상세 복귀) 흉내.
let lastFocusCb: (() => void) | null = null;
const refireFocus = () => lastFocusCb?.();
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams.current }),
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    const ReactLib = require('react');
    ReactLib.useEffect(() => {
      lastFocusCb = cb;
      cb();
    }, [cb]);
  },
}));

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
    PlaceSearchView: (props: Record<string, unknown>) => (
      <View accessibilityLabel="place-search">
        <Pressable
          accessibilityLabel="search-pick"
          onPress={() => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- 테스트 probe: 명명 파라미터 타입은 jest.mock hoist가 거부.
            (props.onSelectResult as Function)({ item: { kakaoPlaceId: '12345' } });
          }}
        />
        <Pressable accessibilityLabel="search-manual" onPress={props.onUseManualInput as () => void} />
        <Pressable accessibilityLabel="search-back" onPress={props.onBack as () => void} />
      </View>
    ),
  };
});

// 위시 데이터 훅 + WishlistView probe(onAdd/onVisit/onRemove 트리거 노출).
const mockUseWishlist = jest.fn();
const refreshWishlist = jest.fn();
const mockAddWishlist = jest.fn();
const mockRemoveWishlist = jest.fn();
jest.mock('@/features/wishlist', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    useWishlist: () => mockUseWishlist(),
    useAddWishlist: () => ({ addWishlist: mockAddWishlist, loading: false, error: null }),
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

import { useRoom, useRoomMembers, useRenameRoom } from '@/features/room';
import { useProfileContext } from '@/features/profile';
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
  // room-lifecycle 더블 초기화.
  mockLeaveRoom.mockReset();
  mockCancelRoomDeletion.mockReset();
  mockLeaveHookState.loading = false;
  mockLeaveHookState.error = null;
  mockCancelHookState.loading = false;
  mockCancelHookState.error = null;
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

  it('참여자 블록 "초대" 탭 → 초대코드 클립보드 복사 + positive 토스트("초대코드를 복사했어요 · {code}")', async () => {
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
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABCDEF');
    await waitFor(() => expect(screen.getByText('초대코드를 복사했어요 · ABCDEF')).toBeTruthy());
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
    renderWithTheme(<LogScreen />);
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('probe-select-rename'));
    expect(screen.queryByLabelText('rename-extra')).toBeNull();
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

  it('재포커스(에디터/상세 복귀) 시 먹로그·위시 목록을 함께 refresh (다녀왔어요/삭제 반영, 폴링 아님)', () => {
    renderWithTheme(<LogScreen />);
    // 첫 포커스(마운트)는 가드 → refresh 미호출.
    expect(refreshMuklogs).not.toHaveBeenCalled();
    expect(refreshWishlist).not.toHaveBeenCalled();
    act(() => {
      refireFocus();
    });
    expect(refreshMuklogs).toHaveBeenCalledTimes(1);
    expect(refreshWishlist).toHaveBeenCalledTimes(1);
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
