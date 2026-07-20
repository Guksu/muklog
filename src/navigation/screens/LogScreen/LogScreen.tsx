// src/navigation/screens/LogScreen.tsx
// 로그 진입 화면 — 킷 mk-log.jsx:9-77 LogScreen 재현 (plan §5 B2 / §6.1).
//   상단 헤더: 본인(+커플이면 익명 파트너) 아바타 겹침 + 로그명("{닉}의 기록"/"{닉} · 짝꿍"). 멤버 배지 없음(킷 헤더 정합).
//   초대 영역: 솔로=InviteCodeCard 강조 / 커플=컴팩트 1줄(link + "초대코드 XXXXXX" + 복사). (기존 "둘이 함께 기록 중" 교체)
//   하단: MuklogList(맛집 리스트 + 카테고리 필터 칩 + "우리 맛집 N" 섹션 + FAB) — 칩/필터/섹션 배선은 developer(MuklogList).
//
// 생산자(소비): useRoom(get_room)→RoomDetail / useProfile(본인 닉/아바타) / useAuth(meId). 스타일=토큰만(raw hex 0).
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import {
  Button,
  IconButton,
  IconName,
  InviteCodeCard,
  RenameDialog,
  Screen,
  SegmentControl,
  Text,
  useToastController,
} from '@/components';
import { useAuth } from '@/features/auth';
import { defaultNickname, useProfileContext } from '@/features/profile';
import {
  deletionCountdownLabel,
  displayLogName,
  LeaveLogSheets,
  LogTitleButton,
  logTitleFromMembers,
  mapRoomError,
  ParticipantBlock,
  ScheduledDeletionBanner,
  useCancelRoomDeletion,
  useLeaveRoom,
  useRenameRoom,
  useRoom,
  useRoomMembers,
} from '@/features/room';
import {
  MuklogList,
  placeFieldsFromItem,
  PlaceSearchView,
  useMuklogs,
  usePlaceSearch,
} from '@/features/muklog';
import {
  useAddWishlist,
  useRemoveWishlist,
  useWishlist,
  wishlistExists,
  WishlistView,
  type WishlistState,
} from '@/features/wishlist';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../../routes';

// 로그 내부 세그먼트 키(enum-style 단일 출처) — 'log'(기록)/'wish'(위시리스트). 기본 'log'.
const LogSeg = { Log: 'log', Wish: 'wish' } as const;

// 위시 추가 성공 토스트 카피(킷 mk-log:33).
const WISH_ADDED_TOAST = '위시리스트에 담았어요 📍';
// 이미 담은 장소 안내 카피 — 지도 주변 담기(NEARBY_WISH_COPY.duplicate)와 동일 문구로 흐름 간 동작 통일.
const WISH_DUPLICATE_TOAST = '이미 담은 곳이에요';

// 초대코드 복사 토스트 카피(킷 mk-log:94, tone positive). {code}는 배선 시 치환.
const INVITE_COPIED_TOAST = (code: string) => `초대코드를 복사했어요 · ${code}`;

// 위시 세그 본문 — useWishlist 상태 분기(loading/error/ready→WishlistView). 빈 상태는 WishlistView 내부 담당.
//   데이터/핸들러는 LogScreen이 소유·주입(presentational). 비주얼은 WishlistView(ui-publisher).
const WishlistBody = ({
  state,
  meNickname,
  meAvatarUrl,
  onAdd,
  onVisit,
  onRemove,
  onRetry,
}: {
  state: WishlistState;
  meNickname: string;
  meAvatarUrl: string | null;
  onAdd: () => void;
  onVisit: ({ id }: { id: string }) => void;
  onRemove: ({ id }: { id: string }) => void;
  onRetry: () => void;
}) => {
  const theme = useTheme();

  if (state.status === 'loading') {
    return (
      <View style={styles.wishCenter}>
        <ActivityIndicator testID="wishlist-loading" color={theme.color.primary} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={[styles.wishCenter, { gap: theme.spacing[12] }]}>
        <Text variant="bodySm" color="error" style={styles.center}>
          {state.message}
        </Text>
        <Button
          title="다시 시도"
          accessibilityLabel="다시 시도"
          variant="secondary"
          onPress={onRetry}
        />
      </View>
    );
  }

  return (
    <WishlistView
      items={state.items}
      meNickname={meNickname}
      meAvatarUrl={meAvatarUrl}
      onAdd={onAdd}
      onVisit={onVisit}
      onRemove={onRemove}
    />
  );
};

export const LogScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.LogScreen>>();
  const roomId = route.params?.roomId;
  const { state: authState } = useAuth();
  // 작성자 라벨 파생용 uid. 미인증이어도 빈 문자열로 안전(이 화면은 AuthGate authenticated 하에만 진입).
  const meId = authState.status === 'authenticated' ? authState.userId : '';

  // ⚠️ 훅은 조건부 호출 불가 → roomId/meId 없을 때도 안전한 값으로 호출하고 렌더에서 분기.
  const { state, refresh } = useRoom({ roomId: roomId ?? '' });
  // 참여자 블록/제목 파생용 멤버 목록(members-display S5b, list_room_members). 진입 1회(비용 §8, 폴링 0).
  //   loading/error는 best-effort — 리스트/화면을 막지 않고 참여자 블록만 미렌더(plan §4.1).
  const { state: membersState } = useRoomMembers({ roomId: roomId ?? '' });
  // #2: 공유 프로필 context — ProfileScreen 변경이 이 화면 헤더/이름 폴백에도 즉시 전파.
  const { state: profileState } = useProfileContext();
  const { renameRoom, loading: renaming, error: renameError } = useRenameRoom();
  // 나가기/예약삭제 취소(room-lifecycle). leaveRoom 결과(scheduled/roomDeleted)로 nav·refresh 분기(§3 통합 레시피).
  const { leaveRoom, loading: leaving, error: leaveError } = useLeaveRoom();
  const { cancelRoomDeletion, loading: canceling } = useCancelRoomDeletion();
  const meNickname =
    profileState.status === 'ready' && profileState.profile.nickname
      ? profileState.profile.nickname
      : defaultNickname({ userId: meId }); // #3: 닉 미설정 시 결정적 기본 닉네임(동물명+숫자)
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // 이름 편집 다이얼로그 open 상태(로컬 UI). 저장 성공 시 닫고 useRoom.refresh로 헤더 갱신(비-낙관적, plan §3.4).
  //   RenameDialog는 controlled → 입력 draft를 부모(LogScreen)가 소유한다(open 시 현재 로그명으로 초기화).
  const [editOpen, setEditOpen] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');

  // 나가기 메뉴/확인 시트 open 상태(로컬 UI, 순수 boolean). 메뉴 → 확인 → leaveRoom 성공 분기(§3.3).
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // ── 위시리스트(wishlist 스프린트) — 세그 카운트·본문·추가/삭제/다녀왔어요 데이터 소유 ──────────────
  //   먹로그/위시 목록을 LogScreen이 단일 소유(세그 카운트 확보·이중 로드 0). MuklogList/WishlistView는 presentational.
  const { state: muklogsState, refresh: refreshMuklogs } = useMuklogs({ roomId: roomId ?? '' });
  const { state: wishlistState, refresh: refreshWishlist } = useWishlist({ roomId: roomId ?? '' });
  const { addWishlist } = useAddWishlist();
  const { removeWishlist } = useRemoveWishlist();
  // 추가 플로우 장소검색(muklog-place 재사용 — 신규 Kakao 호출 0, 기존 usePlaceSearch 디바운스/캐싱).
  const placeSearch = usePlaceSearch();
  // 세그 상태(기본 'log') + 위시 추가 풀스크린 검색 스왑(MuklogEditor searching 패턴 동일).
  const [seg, setSeg] = React.useState<string>(LogSeg.Log);
  const [wishSearching, setWishSearching] = React.useState(false);
  // 위시 추가 in-flight 가드 — 연속 탭(검색 결과/직접 입력) 중복 insert 차단. state는 비동기 갱신이라
  //   레이스를 못 막으므로 ref로 동기 잠금(지도 주변 담기 useAddNearbyWish.submittingRef 선례).
  const submittingWishRef = React.useRef(false);
  // 위시 추가 성공/예약취소 에러 토스트 — 전역 토스트 컨트롤러(루트 단일 <Toast>). 트리거만 호출(비주얼·타이머는 Toast 소유).
  const { showToast } = useToastController();

  // 재포커스(에디터/상세 복귀) 시 두 목록을 함께 1회 refresh(첫 포커스=마운트 로드와 겹쳐 가드). 폴링 아님(plan §6·§10).
  //   다녀왔어요 플로우(먹로그+1·위시-1)·삭제·편집 반영을 단일 포커스 훅으로 처리.
  const refreshMuklogsRef = React.useRef(refreshMuklogs);
  refreshMuklogsRef.current = refreshMuklogs;
  const refreshWishlistRef = React.useRef(refreshWishlist);
  refreshWishlistRef.current = refreshWishlist;
  const hasFocusedRef = React.useRef(false);
  // useFocusEffect는 콜백 참조 안정성이 필수 → 예외적으로 useCallback(컨벤션 허용 케이스).
  const handleFocus = React.useCallback(function refreshListsOnRefocus() {
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true; // 첫 포커스 = 마운트 로드 → 중복 조회 가드.
      return;
    }
    void refreshMuklogsRef.current();
    void refreshWishlistRef.current();
  }, []);
  useFocusEffect(handleFocus);

  if (!roomId) {
    return (
      <Screen center>
        <Text variant="body" color="fgWeak" style={styles.center}>
          로그를 찾을 수 없어요
        </Text>
      </Screen>
    );
  }

  if (state.status === 'loading') {
    return (
      <Screen center>
        <ActivityIndicator testID="logscreen-loading" color={theme.color.primary} />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen center>
        <Text variant="body" color="error" style={styles.center}>
          {state.message}
        </Text>
        <Button
          title="다시 시도"
          accessibilityLabel="다시 시도"
          variant="secondary"
          onPress={() => void refresh()}
          style={{ marginTop: theme.spacing[16] }}
        />
      </Screen>
    );
  }

  // ── 위시 세그 카운트 + 핸들러(roomId는 위 가드로 string 확정) ──────────────────────────────
  const muklogCount = muklogsState.status === 'ready' ? muklogsState.muklogs.length : 0;
  const wishCount = wishlistState.status === 'ready' ? wishlistState.items.length : 0;

  // 추가: AddWishlistInput으로 insert → 성공 시 위시 목록 refresh + 토스트, 검색뷰 복귀. 실패 시 목록 불변(토스트 없음, TC-2).
  const addWishFromInput = async ({
    input,
  }: {
    input: Parameters<typeof addWishlist>[0]['input'];
  }) => {
    if (submittingWishRef.current) return; // 연타 중복 insert 차단(동기 잠금).
    submittingWishRef.current = true;
    try {
      // 중복 pre-check — 카카오 장소 id가 있는 검색 결과만(직접 입력은 id 없어 dedup 불가·스킵).
      //   이미 담은 곳이면 insert 스킵 + 안내 토스트(지도 주변 담기와 동작 통일, best-effort). 검색뷰는 복귀.
      if (input.kakaoPlaceId) {
        const duplicate = await wishlistExists({
          roomId: input.roomId,
          kakaoPlaceId: input.kakaoPlaceId,
        });
        if (duplicate) {
          showToast({ message: WISH_DUPLICATE_TOAST, tone: 'neutral' });
          setWishSearching(false);
          return;
        }
      }
      await addWishlist({ input });
      await refreshWishlist();
      showToast({ message: WISH_ADDED_TOAST, tone: 'positive' });
    } catch {
      // addWishlist/pre-check가 error 상태로 노출 — 목록 불변, 토스트 없음(plan TC-2 실패).
    } finally {
      submittingWishRef.current = false;
    }
    setWishSearching(false);
  };

  // WishlistView "추가"/빈상태 CTA → 풀스크린 장소검색 진입(검색어 초기화).
  const handleAddWish = () => {
    placeSearch.setQuery('');
    setWishSearching(true);
  };

  // 검색 결과 선택 → 장소 필드 매핑(placeFieldsFromItem) → insert(note는 이번 스프린트 항상 null).
  const handleWishPick = ({ item }: { item: Parameters<typeof placeFieldsFromItem>[0]['item'] }) => {
    const sel = placeFieldsFromItem({ item });
    void addWishFromInput({
      input: {
        roomId,
        placeName: sel.placeName,
        category: sel.category,
        area: sel.area,
        roadAddress: sel.roadAddress,
        lat: sel.lat,
        lng: sel.lng,
        kakaoPlaceId: sel.kakaoPlaceId,
      },
    });
  };

  // 검색 0건/실패 → "직접 입력"(검색어를 장소명으로, 좌표 없음). 빈 검색어면 무시.
  const handleWishManual = () => {
    const name = placeSearch.query.trim();
    if (name.length === 0) return;
    void addWishFromInput({
      input: {
        roomId,
        placeName: name,
        category: null,
        area: null,
        roadAddress: null,
        lat: null,
        lng: null,
        kakaoPlaceId: null,
      },
    });
  };

  // 다녀왔어요 → MuklogEditor 생성 모드 + 프리필 + fromWishlistId(생성 성공 시 위시 삭제, plan §4.5·TC-5).
  const handleVisitWish = ({ id }: { id: string }) => {
    const item =
      wishlistState.status === 'ready'
        ? wishlistState.items.find((w) => w.id === id)
        : undefined;
    if (!item) return;
    navigation.navigate(Routes.MuklogEditor, {
      roomId,
      prefill: {
        placeName: item.placeName,
        category: item.category,
        area: item.area,
        roadAddress: item.roadAddress,
        lat: item.lat,
        lng: item.lng,
        kakaoPlaceId: item.kakaoPlaceId,
      },
      fromWishlistId: id,
    });
  };

  // 삭제(✕) → removeWishlist → 위시 목록 refresh. 실패 시 항목 유지(plan TC-4 실패).
  const handleRemoveWish = async ({ id }: { id: string }) => {
    try {
      await removeWishlist({ id });
      await refreshWishlist();
    } catch {
      // removeWishlist가 error 상태로 노출 — 항목 유지(refresh 기반이라 자동 롤백).
    }
  };

  // 위시 추가 풀스크린 장소검색(MuklogEditor searching 스왑과 동일 패턴) — 폼 대신 PlaceSearchView로 스왑.
  if (wishSearching) {
    return (
      <PlaceSearchView
        query={placeSearch.query}
        onChangeQuery={placeSearch.setQuery}
        status={placeSearch.status}
        results={placeSearch.results}
        errorMessage={placeSearch.errorMessage}
        onSelectResult={handleWishPick}
        onUseManualInput={handleWishManual}
        onBack={() => setWishSearching(false)}
        backLabel="검색 취소"
      />
    );
  }

  const { room } = state;
  const isCouple = room.memberCount >= 2;

  // 멤버 목록(members-display S5b) — ready면 실 멤버, 아니면 빈 배열(제목/블록 폴백 회귀).
  const members = membersState.status === 'ready' ? membersState.members : [];

  // 헤더 표시명 — name 우선(현행), 없으면 멤버-기반 파생(logTitleFromMembers, 킷 mkLogTitle).
  //   멤버 미로드(빈 배열)면 유틸 내부에서 displayLogName 폴백으로 회귀(회귀 0, plan §4.2).
  const title = logTitleFromMembers({
    name: room.name,
    members,
    meId,
    selfNickname: meNickname,
  });
  // 시트 placeholder = 이름 없을 때의 폴백명(displayLogName name:null). 입력 초기값은 이름 있으면 name·없으면 빈 문자열.
  const fallbackName = displayLogName({
    name: null,
    memberCount: room.memberCount,
    selfNickname: meNickname,
  });

  // 다이얼로그 열기 — draft를 현재 로그명(없으면 빈 문자열)으로 초기화한 뒤 open(재오픈 시에도 현재값으로 재동기화, AC2.6).
  const handleOpenNameEdit = () => {
    setNameDraft(room.name ?? '');
    setEditOpen(true);
  };

  // 저장: 입력 원문(draft)을 renameRoom에 전달(정규화는 훅 내부) → 성공 시 다이얼로그 닫고 refresh로 헤더 갱신.
  //   실패(throw)는 useRenameRoom이 error를 세팅하고 다이얼로그는 열린 채(입력 보존·재시도). refresh는 1회만(비용 §8).
  const handleSaveName = async (next: string) => {
    try {
      await renameRoom({ roomId, name: next });
      setEditOpen(false);
      await refresh();
    } catch {
      // error 메시지는 useRenameRoom.error → RenameDialog error prop으로 표시. 다이얼로그 유지.
    }
  };

  // 나가기 확정 — 커플=24h 예약 후 확인 닫고 refresh(배너 표시·화면 유지) / 솔로=즉시 삭제 후 목록 복귀(goBack).
  //   성공 시 SPEC §4-1 토스트(전역, positive): 솔로 "로그를 삭제했어요" / 커플 "로그에서 나갔어요 · 24시간 뒤 삭제돼요".
  //   전역 토스트라 솔로 goBack 후 홈에서도 표시 유지(언마운트 무관, S4). 실패(throw)는 토스트 없음 →
  //   useLeaveRoom.error → LeaveLogSheets leaveError 인라인. 확인 시트 유지(재시도, plan §4).
  //   목록 refresh는 LogListScreen 포커스 정책이 담당(여기선 goBack만, 비용 §8).
  const handleLeave = async () => {
    try {
      const res = await leaveRoom({ roomId });
      setConfirmOpen(false);
      if (res.roomDeleted) {
        // 솔로 즉시 삭제 → 홈 복귀 + 삭제 완료 토스트(전역이라 복귀 화면 위에서 표시).
        showToast({ message: '로그를 삭제했어요', tone: 'positive' });
        navigation.goBack();
        return;
      }
      // 커플 예약 → 예약 배너 표시 위해 1회 refresh(화면 유지) + 나가기 완료 토스트.
      await refresh();
      showToast({ message: '로그에서 나갔어요 · 24시간 뒤 삭제돼요', tone: 'positive' });
    } catch {
      // error는 useLeaveRoom.error로 노출 → 확인 시트 인라인. 시트 유지(닫지 않음). 토스트 없음.
    }
  };

  // 예약 삭제 취소(요청자 전용) — 성공 시 refresh로 배너 사라짐. 실패 시 한국어 토스트 + refresh로 상태 reconcile
  //   (예: cron이 먼저 삭제 → NOT_SCHEDULED → 토스트 안내 후 refresh로 화면 정합, plan §6).
  const handleCancelDeletion = async () => {
    try {
      await cancelRoomDeletion({ roomId });
      await refresh();
    } catch (err) {
      showToast({ message: mapRoomError({ error: err }), tone: 'neutral' });
      await refresh();
    }
  };

  // 참여자 블록 "초대" 버튼(members-display S5b, 킷 mk-log:94) — 초대코드 클립보드 복사 + positive 토스트.
  //   초대코드는 상위(room.inviteCode) 소유. members<5일 때만 블록이 버튼을 렌더(canInvite).
  const handleInvite = async () => {
    await Clipboard.setStringAsync(room.inviteCode);
    showToast({ message: INVITE_COPIED_TOAST(room.inviteCode), tone: 'positive' });
  };

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 'bottom' 제외: 비-GNB 엣지투엣지 하단 빈 띠 방지 — 최하단 리스트(MuklogList/WishlistView) 스크롤
          paddingBottom에 insets.bottom을 반영해 인디케이터 클리어(배경은 화면 끝까지). */}
      {/* 상단 헤더 — 뒤로가기 + 아바타 겹침 + 로그명(킷 mk-log:18-29). 킷 헤더엔 멤버 배지 없음(커플 여부는 아바타 겹침으로 표현).
          네이티브 헤더는 숨김(AppNavigator) — 이 자체 헤더가 단일 헤더(이중 헤더 방지).
          ⚠️ 네이티브 헤더 OFF로 사라진 top inset을 여기서 보전 — 킷 MK_STATUS_PAD=56(시뮬 근사 고정) 대신
          insets.top + spacing[8](HomeHeader와 동일 패턴)으로 동적 번역해 노치/다이나믹 아일랜드 겹침 방지. */}
      <View
        testID="logscreen-header"
        style={[
          styles.header,
          {
            paddingLeft: theme.spacing[8],
            paddingRight: theme.spacing[12],
            paddingTop: insets.top + theme.spacing[8],
          },
        ]}
      >
        <IconButton
          name={IconName.ChevronLeft}
          size={24}
          color="fg"
          accessibilityLabel="뒤로 가기"
          onPress={() => navigation.goBack()}
        />
        {/* 로그명 표시(display-only). 헤더 아바타 겹침은 참여자 블록으로 이동(members-display S5b, plan §4.2).
            이름 변경은 ⋯메뉴 "로그 이름 변경"으로 이전(사용자 요청) — 타이틀 탭 동작 없음. */}
        <LogTitleButton title={title} />
        {/* ⋯ 더보기 — 나가기 메뉴 시트 open(LogTitleButton flex:1로 우측 끝 정렬, ui-spec §3.3-1). */}
        <IconButton
          name={IconName.MoreHorizontal}
          size={24}
          color="fg"
          accessibilityLabel="더보기"
          onPress={() => setMenuOpen(true)}
        />
      </View>

      {/* 예약삭제 배너 — 헤더 아래·세그 위, deleteScheduledAt 있을 때만(게이팅은 여기, ui-spec §3.2).
          세그 무관 항상 표시(예약은 로그 전체 상태). 요청자=취소 버튼 / 상대=안내만(ScheduledDeletionBanner 내부). */}
      {room.deleteScheduledAt ? (
        <View style={{ paddingHorizontal: theme.spacing[20], paddingTop: theme.spacing[8] }}>
          <ScheduledDeletionBanner
            countdownLabel={deletionCountdownLabel({
              scheduledAt: room.deleteScheduledAt,
              now: Date.now(),
            })}
            isRequester={meId === room.deleteRequestedBy}
            onCancel={() => void handleCancelDeletion()}
            canceling={canceling}
          />
        </View>
      ) : null}

      {/* 세그먼트(기록 N / 위시리스트 M) — 킷 mk-log:56-72. 컨테이너 패딩 "6px 20px 2px"(상6/좌우20/하2). */}
      <View style={styles.segWrap}>
        <SegmentControl
          segments={[
            { key: LogSeg.Log, label: '기록', count: muklogCount },
            { key: LogSeg.Wish, label: '위시리스트', count: wishCount },
          ]}
          selected={seg}
          onChange={({ key }) => setSeg(key)}
        />
      </View>

      {/* 본문 스위치 — 'log'=MuklogList(+FAB) / 'wish'=WishlistView(FAB 없음, 킷 mk-log:119). */}
      <View style={styles.body}>
        {seg === LogSeg.Wish ? (
          <WishlistBody
            state={wishlistState}
            meNickname={meNickname}
            meAvatarUrl={meAvatarUrl ?? null}
            onAdd={handleAddWish}
            onVisit={handleVisitWish}
            onRemove={(arg) => void handleRemoveWish(arg)}
            onRetry={() => void refreshWishlist()}
          />
        ) : (
          // 참여자 블록(members-display S5b, 킷 mk-log:79-103)을 MuklogList 스크롤 헤더로 주입 — 리스트와 함께 스크롤돼
          //   위로 사라진다(사용자 요청). wish 세그엔 미렌더(I1). 구 솔로 배너/커플 컴팩트 행/헤더 익명 아바타는 이 블록으로 대체.
          //   멤버 ready일 때만 렌더(loading/error는 best-effort 미렌더 — 리스트를 막지 않음, plan §4.1).
          <MuklogList
            roomId={roomId}
            meId={meId}
            state={muklogsState}
            refresh={refreshMuklogs}
            header={
              membersState.status === 'ready' ? (
                <ParticipantBlock
                  members={membersState.members}
                  meId={meId}
                  canInvite={membersState.members.length < 5}
                  onInvite={() => void handleInvite()}
                />
              ) : null
            }
          />
        )}
      </View>

      {/* 로그 이름 편집 다이얼로그(킷 mk-extra:24-64 RenameDialog) — pencil 탭으로 open. 저장 → renameRoom → 성공 시 close + refresh.
          controlled: draft(nameDraft)는 LogScreen 소유. subtitle은 킷 D-7(💡 제거). extra=초대코드는 솔로(memberCount<2)만 노출(D-2/AC2.5). */}
      <RenameDialog
        open={editOpen}
        title="로그 이름"
        subtitle="비워두면 기본 이름으로 돌아가요"
        value={nameDraft}
        onChange={setNameDraft}
        onCancel={() => setEditOpen(false)}
        onSave={() => void handleSaveName(nameDraft)}
        placeholder={fallbackName}
        saving={renaming}
        error={renameError}
        extra={isCouple ? undefined : <InviteCodeCard code={room.inviteCode} compact />}
      />

      {/* 나가기 메뉴 + 확인 시트(room-lifecycle, 킷 비종속·MuklogDetail 패턴) — open은 LogScreen 소유, RPC·nav는 handleLeave.
          성공 시 닫기는 controlled(커플=refresh·솔로=goBack). 카피 분기(커플 24h 유예 / 솔로 즉시)는 isCouple으로. */}
      <LeaveLogSheets
        menuVisible={menuOpen}
        confirmVisible={confirmOpen}
        isCouple={isCouple}
        onCloseMenu={() => setMenuOpen(false)}
        onSelectRename={() => {
          setMenuOpen(false);
          handleOpenNameEdit();
        }}
        onSelectLeave={() => {
          setMenuOpen(false);
          setConfirmOpen(true);
        }}
        onCloseConfirm={() => setConfirmOpen(false)}
        onConfirmLeave={() => void handleLeave()}
        leaving={leaving}
        leaveError={leaveError}
      />

      {/* 위시 추가 성공/예약취소 에러 토스트는 전역(ToastProvider 루트 <Toast>)에서 렌더 — 화면별 <Toast> 없음(이관). */}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  center: { textAlign: 'center' },
  // 킷 mk-log:18 — paddingBottom 6, 좌우는 인라인(8/12). 뒤로가기↔본문 간격은 LogTitleButton marginLeft.
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  // 세그 컨테이너(킷 mk-log:57 패딩 "6px 20px 2px") + 본문 영역(남은 높이 채움).
  segWrap: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 2 },
  body: { flex: 1 },
  // 위시 본문 loading/error 센터 박스(빈 상태·리스트는 WishlistView 내부).
  wishCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
});
