// src/navigation/screens/LogScreen.tsx
// 로그 진입 화면 — 킷 mk-log.jsx:9-77 LogScreen 재현 (plan §5 B2 / §6.1).
//   상단 헤더: 본인(+커플이면 익명 파트너) 아바타 겹침 + 로그명("{닉}의 기록"/"{닉} ♥ 짝꿍"). 멤버 배지 없음(킷 헤더 정합).
//   초대 영역: 솔로=InviteCodeCard 강조 / 커플=컴팩트 1줄(link + "초대코드 XXXXXX" + 복사). (기존 "둘이 함께 기록 중" 교체)
//   하단: MuklogList(맛집 리스트 + 카테고리 필터 칩 + "우리 맛집 N" 섹션 + FAB) — 칩/필터/섹션 배선은 developer(MuklogList).
//
// 생산자(소비): useRoom(get_room)→RoomDetail / useProfile(본인 닉/아바타) / useAuth(meId). 스타일=토큰만(raw hex 0).
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native';
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
  Avatar,
  Button,
  Icon,
  IconButton,
  IconName,
  InviteCodeCard,
  RenameDialog,
  Screen,
  SegmentControl,
  Text,
  Toast,
  useToast,
} from '@/components';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import {
  displayLogName,
  LogTitleButton,
  useRenameRoom,
  useRoom,
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
  WishlistView,
  type WishlistState,
} from '@/features/wishlist';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

const HEADER_AVATAR_SIZE = 28;
const COPIED_FEEDBACK_MS = 2000;

// 로그 내부 세그먼트 키(enum-style 단일 출처) — 'log'(기록)/'wish'(위시리스트). 기본 'log'.
const LogSeg = { Log: 'log', Wish: 'wish' } as const;

// 위시 추가 성공 토스트 카피(킷 mk-log:33).
const WISH_ADDED_TOAST = '위시리스트에 담았어요 📍';

// 커플 컴팩트 초대코드 행 — link 아이콘 + "초대코드 XXXXXX" + 복사(클립보드).
const CompactInviteRow = ({ code }: { code: string }) => {
  const theme = useTheme();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(
    function clearCompactCopied() {
      if (!copied) return;
      const reset = () => setCopied(false);
      const id = setTimeout(reset, COPIED_FEEDBACK_MS);
      return function stopCompactTimer() {
        clearTimeout(id);
      };
    },
    [copied],
  );

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  return (
    <View style={[styles.compactRow, { gap: theme.spacing[8] }]}>
      <Icon name={IconName.Link} size={15} color="fgMuted" />
      <Text variant="meta" color="fgMuted" style={styles.compactCode}>
        {`초대코드 ${code}`}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="초대코드 복사"
        onPress={() => void handleCopy()}
        hitSlop={8}
      >
        <Text variant="badge" color="accentStrong">
          {copied ? '복사됨' : '복사'}
        </Text>
      </Pressable>
    </View>
  );
};

// 솔로(미커플) 초대 배너 — 킷 mk-log:33-45. accent-weak(primaryWeak) 배경 카드 안에
//   💌 + 헤딩("연인을 초대해보세요") + 설명문 + InviteCodeCard(코드+복사). 이모지는 별도 RNText(클리핑 방지).
const SoloInviteBanner = ({ code }: { code: string }) => {
  const theme = useTheme();
  const banner: ViewStyle = {
    backgroundColor: theme.color.primaryWeak,
    borderRadius: theme.radius.sheet,
    padding: theme.spacing[16],
    gap: theme.spacing[12],
  };
  return (
    <View style={banner}>
      <View style={[styles.bannerHead, { gap: theme.spacing[8] }]}>
        <RNText style={styles.bannerEmoji}>💌</RNText>
        <Text variant="fieldLabel" color="fg" style={styles.bannerHeading}>
          연인을 초대해보세요
        </Text>
      </View>
      <Text variant="bodySm" color="fgWeak">
        이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요.
      </Text>
      <InviteCodeCard code={code} compact />
    </View>
  );
};

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
  const { state: profileState } = useProfile({ userId: meId });
  const { renameRoom, loading: renaming, error: renameError } = useRenameRoom();
  const meNickname =
    profileState.status === 'ready' && profileState.profile.nickname
      ? profileState.profile.nickname
      : '나';
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // 이름 편집 다이얼로그 open 상태(로컬 UI). 저장 성공 시 닫고 useRoom.refresh로 헤더 갱신(비-낙관적, plan §3.4).
  //   RenameDialog는 controlled → 입력 draft를 부모(LogScreen)가 소유한다(open 시 현재 로그명으로 초기화).
  const [editOpen, setEditOpen] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');

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
  // 위시 추가 성공 토스트(공용 프리미티브) — show/hide만 트리거(비주얼·타이머는 Toast 소유).
  const { toast, show: showToast, hide: hideToast } = useToast();

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
    try {
      await addWishlist({ input });
      await refreshWishlist();
      showToast({ message: WISH_ADDED_TOAST, tone: 'positive' });
    } catch {
      // addWishlist가 error 상태로 노출 — 목록 불변, 토스트 없음(plan TC-2 실패).
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

  // 헤더/시트 표시명·placeholder 단일 출처(displayLogName, 결정2 B'). selfNickname=본인 닉(파트너 닉 미사용).
  const title = displayLogName({
    name: room.name,
    memberCount: room.memberCount,
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

  // 헤더 아바타 겹침 슬롯(LogTitleButton.avatarSlot로 주입). 데이터(아바타 url·커플 여부)는 여기서 구성.
  const avatarSlot = (
    <View style={styles.avatarStack}>
      <Avatar url={meAvatarUrl} userId={meId} size={HEADER_AVATAR_SIZE} />
      {isCouple ? (
        // 파트너 실데이터 미보유 → 익명 아바타(🙂) 겹침(marginLeft -9, 킷 23).
        <View style={{ marginLeft: -9 }}>
          <Avatar url={null} userId={null} nickname={null} size={HEADER_AVATAR_SIZE} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen edges={['left', 'right', 'bottom']} style={styles.screen}>
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
        {/* 킷 mk-log:32-41 — 아바타 겹침 + 로그명 + ✏️를 하나의 탭 가능 버튼으로(탭 → 이름 편집 시트 open). */}
        <LogTitleButton title={title} avatarSlot={avatarSlot} onEdit={handleOpenNameEdit} />
      </View>

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
          <>
            {/* 초대 영역(킷 mk-log:74-90) — 'log' 세그 본문 상단(세그 아래). wish 세그엔 미렌더(I1).
                비주얼(솔로 배너/커플 컴팩트 행)은 불변 — 위치만 킷 정합. */}
            <View style={{ paddingHorizontal: theme.spacing[20], paddingTop: theme.spacing[12] }}>
              {isCouple ? (
                <CompactInviteRow code={room.inviteCode} />
              ) : (
                <SoloInviteBanner code={room.inviteCode} />
              )}
            </View>
            <MuklogList
              roomId={roomId}
              meId={meId}
              state={muklogsState}
              refresh={refreshMuklogs}
            />
          </>
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

      {/* 위시 추가 성공 토스트(하단 플로팅) — 킷 mk-log:33 "위시리스트에 담았어요 📍". 자동 사라짐은 Toast 소유. */}
      <Toast {...toast} onHide={hideToast} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  center: { textAlign: 'center' },
  // 킷 mk-log:18 — paddingBottom 6, 좌우는 인라인(8/12). 뒤로가기↔본문 간격은 LogTitleButton marginLeft.
  header: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  compactRow: { flexDirection: 'row', alignItems: 'center' },
  compactCode: { flex: 1 },
  // 솔로 배너(킷 mk-log:36-42) — 헤딩 행(💌+텍스트), 이모지는 클리핑 헤드룸 위해 lineHeight 지정.
  bannerHead: { flexDirection: 'row', alignItems: 'center' },
  bannerEmoji: { fontSize: 20, lineHeight: 26 },
  bannerHeading: { flex: 1 },
  // 세그 컨테이너(킷 mk-log:57 패딩 "6px 20px 2px") + 본문 영역(남은 높이 채움).
  segWrap: { paddingTop: 6, paddingHorizontal: 20, paddingBottom: 2 },
  body: { flex: 1 },
  // 위시 본문 loading/error 센터 박스(빈 상태·리스트는 WishlistView 내부).
  wishCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
});
