// src/navigation/screens/MuklogDetailScreen.spec.tsx
// 먹로그 상세(읽기 전용) — 킷 mk-log.jsx:122-192 MuklogDetail 비주얼 골격 (plan §6③⑤, AC a~e).
//   순수 표시 컴포넌트: 데이터/상태/onBack을 props로 받는다(useMuklog/useProfile/navigation 배선은 developer).
//   검증: 캐러셀(0/1/N장·인디케이터), category/rating/memo NULL 폴백, back→onBack, share/more 부재,
//         작성자 라벨, hasCoords stub 분기, loading/notFound/error 상태.
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// MuklogMiniMap이 @/lib/env(모듈 로드 시 SUPABASE_URL 필수 throw)·react-native-webview를 전이 import → 스텁.
//   KAKAO_JS_KEY '' → 미니맵 폴백(텍스트 박스) 경로(이 스펙은 위치 섹션 폴백 동작을 검증).
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: '' } }));
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    return { WebView: (props: Record<string, unknown>) => <Rn.View testID="webview" {...props} /> };
  },
  { virtual: true },
);

import {
  MuklogDetailScreen,
  type MuklogDetailPhoto,
  type MuklogDetailViewData,
} from './MuklogDetailScreen';

const photo = (over?: Partial<MuklogDetailPhoto>): MuklogDetailPhoto => ({
  orderIndex: 0,
  uri: 'https://signed.example/p0.jpg',
  ...over,
});

const data = (over?: Partial<MuklogDetailViewData>): MuklogDetailViewData => ({
  id: 'm1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  memo: '둘이 먹은 까르보나라가 인생 맛.',
  rating: 5,
  visitedAt: '2026-02-14',
  roadAddress: '서울 마포구 연남로 1',
  hasCoords: false,
  lat: null,
  lng: null,
  createdBy: 'me-uid',
  photos: [photo()],
  ...over,
});

const onBack = jest.fn();
const onRetry = jest.fn();

const renderReady = (over?: Partial<MuklogDetailViewData>) =>
  renderWithTheme(
    <MuklogDetailScreen
      state={{ status: 'ready', muklog: data(over) }}
      meId="me-uid"
      meAvatarUrl={null}
      onBack={onBack}
      onRetry={onRetry}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe('MuklogDetailScreen — 상태 분기', () => {
  it('loading이면 로더를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'loading' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('muklog-detail-loading')).toBeTruthy();
  });

  it('notFound면 "찾을 수 없어요" 안내 + 뒤로가기를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'notFound' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByTestId('muklog-detail-notfound')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('error면 메시지 + 다시 시도(onRetry)를 표시한다', () => {
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'error', message: '조회 실패' }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('조회 실패')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('MuklogDetailScreen — 사진 캐러셀 (AC a/b)', () => {
  it('사진 N(>1)장이면 페이지 인디케이터를 표시한다', () => {
    renderReady({
      photos: [
        photo({ orderIndex: 0, uri: 'u0' }),
        photo({ orderIndex: 1, uri: 'u1' }),
        photo({ orderIndex: 2, uri: 'u2' }),
      ],
    });
    expect(screen.getByTestId('muklog-detail-indicator')).toBeTruthy();
    expect(screen.getAllByTestId('muklog-detail-photo')).toHaveLength(3);
    // FoodCover 폴백은 사진이 있으면 렌더하지 않는다.
    expect(screen.queryByTestId('muklog-detail-cover-fallback')).toBeNull();
  });

  it('인디케이터 bottom이 본문 겹침(marginTop -18)을 넘어 가려지지 않는다 (회귀: 불릿이 상세에 가림)', () => {
    renderReady({
      photos: [photo({ orderIndex: 0, uri: 'u0' }), photo({ orderIndex: 1, uri: 'u1' })],
    });
    const indicator = screen.getByTestId('muklog-detail-indicator');
    // 본문이 사진 하단 18px를 덮으므로 인디케이터 bottom은 18 초과여야 한다(그래야 본문 위로 보임).
    expect(StyleSheet.flatten(indicator.props.style).bottom).toBeGreaterThan(18);
  });

  it('사진 1장이면 인디케이터를 표시하지 않는다', () => {
    renderReady({ photos: [photo()] });
    expect(screen.getByTestId('muklog-detail-photo')).toBeTruthy();
    expect(screen.queryByTestId('muklog-detail-indicator')).toBeNull();
  });

  it('사진 0장이면 FoodCover 폴백 1칸 + 인디케이터 없음 (AC b)', () => {
    renderReady({ photos: [] });
    expect(screen.getByTestId('muklog-detail-cover-fallback')).toBeTruthy();
    expect(screen.queryByTestId('muklog-detail-photo')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-indicator')).toBeNull();
  });
});

describe('MuklogDetailScreen — 본문 NULL 폴백 (AC c)', () => {
  it('category가 있으면 카테고리 칩, null이면 칩 미표시', () => {
    renderReady({ category: 'pasta' });
    expect(screen.getByTestId('muklog-detail-category-chip')).toBeTruthy();

    renderReady({ category: null });
    expect(screen.queryByTestId('muklog-detail-category-chip')).toBeNull();
  });

  it('rating이 있으면 평점 숫자, null이면 "미평가"', () => {
    renderReady({ rating: 4 });
    expect(screen.getByText('4.0')).toBeTruthy();

    renderReady({ rating: null });
    expect(screen.getByText('미평가')).toBeTruthy();
  });

  it('memo가 있으면 본문, 없으면 플레이스홀더', () => {
    renderReady({ memo: '맛있었어요' });
    expect(screen.getByText('맛있었어요')).toBeTruthy();

    renderReady({ memo: null });
    expect(screen.getByText('메모가 없어요')).toBeTruthy();
  });

  it('장소명을 타이틀로 표시한다', () => {
    renderReady({ placeName: '연남 파스타집' });
    expect(screen.getByText('연남 파스타집')).toBeTruthy();
  });
});

describe('MuklogDetailScreen — 위치 섹션', () => {
  it('roadAddress가 있으면 위치 박스에 주소를 표시한다(빈 stub 아님 — 회귀: 항상 "없어요" 표시되던 버그)', () => {
    renderReady({ roadAddress: '서울 마포구 연남로 1', hasCoords: true });
    const box = screen.getByTestId('muklog-detail-map-stub');
    // 박스 안에 주소가 보이고, "위치 정보가 아직 없어요" stub은 없다.
    expect(screen.getAllByText('서울 마포구 연남로 1').length).toBeGreaterThan(0);
    expect(within(box).queryByText('위치 정보가 아직 없어요')).toBeNull();
  });

  it('주소는 없지만 좌표가 있으면 박스에 "지도에 위치가 저장됐어요"를 표시한다', () => {
    renderReady({ roadAddress: null, hasCoords: true });
    const box = screen.getByTestId('muklog-detail-map-stub');
    expect(within(box).getByText('지도에 위치가 저장됐어요')).toBeTruthy();
  });

  it('주소·좌표 모두 없으면 박스에 "위치 정보가 아직 없어요" + InfoRow "위치 정보 없음"', () => {
    renderReady({ roadAddress: null, hasCoords: false });
    const box = screen.getByTestId('muklog-detail-map-stub');
    expect(within(box).getByText('위치 정보가 아직 없어요')).toBeTruthy();
    expect(screen.getAllByText('위치 정보 없음').length).toBeGreaterThan(0);
  });
});

describe('MuklogDetailScreen — 상단 글래스 바 (AC d)', () => {
  it('back 버튼은 활성, share/more 버튼은 미렌더', () => {
    renderReady();
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('공유')).toBeNull();
    expect(screen.queryByLabelText('더보기')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-share')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-more')).toBeNull();
  });
});

describe('MuklogDetailScreen — more 메뉴 / 편집·삭제 (muklog-edit §5 ⑤)', () => {
  const renderManage = (over?: {
    canManage?: boolean;
    onEdit?: () => void;
    onConfirmDelete?: () => void;
    deleting?: boolean;
    deleteError?: string | null;
    data?: Partial<MuklogDetailViewData>;
  }) =>
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'ready', muklog: data(over?.data) }}
        meId="me-uid"
        meAvatarUrl={null}
        onBack={onBack}
        onRetry={onRetry}
        canManage={over?.canManage ?? true}
        onEdit={over?.onEdit}
        onConfirmDelete={over?.onConfirmDelete}
        deleting={over?.deleting}
        deleteError={over?.deleteError}
      />,
    );

  it('canManage=true면 more 버튼을 렌더한다 (AC a)', () => {
    renderManage({ canManage: true });
    expect(screen.getByTestId('muklog-detail-more')).toBeTruthy();
    expect(screen.getByLabelText('더보기')).toBeTruthy();
  });

  it('canManage=false(짝꿍 것)면 more 버튼을 미렌더한다 (AC a)', () => {
    renderManage({ canManage: false });
    expect(screen.queryByTestId('muklog-detail-more')).toBeNull();
    expect(screen.queryByLabelText('더보기')).toBeNull();
  });

  it('more 탭 → 메뉴 시트(편집/삭제)를 연다', () => {
    renderManage({ canManage: true });
    // 메뉴 열기 전엔 편집/삭제 행 없음.
    expect(screen.queryByLabelText('편집')).toBeNull();
    fireEvent.press(screen.getByLabelText('더보기'));
    expect(screen.getByLabelText('편집')).toBeTruthy();
    expect(screen.getByLabelText('삭제')).toBeTruthy();
  });

  it('메뉴 "편집" 탭 → onEdit을 호출한다 (AC b)', () => {
    const onEdit = jest.fn();
    renderManage({ canManage: true, onEdit });
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('편집'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('메뉴 "삭제" 탭 → 삭제 확인 시트(킷 카피)를 연다', () => {
    renderManage({ canManage: true, data: { placeName: '보나' } });
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('삭제'));
    expect(screen.getByText('먹로그를 삭제할까요?')).toBeTruthy();
    // 킷 카피 "되돌릴 수 없어요" + place명 포함(확인 본문 한 노드에 둘 다).
    expect(screen.getByText(/‘보나’.*되돌릴 수 없어요/s)).toBeTruthy();
  });

  it('확인 시트 "삭제하기" 탭 → onConfirmDelete를 호출한다 (AC c)', () => {
    const onConfirmDelete = jest.fn();
    renderManage({ canManage: true, onConfirmDelete });
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('삭제'));
    fireEvent.press(screen.getByLabelText('삭제하기'));
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });

  it('삭제 진행 중(deleting)이면 삭제하기 버튼이 비활성이다', () => {
    renderManage({ canManage: true, deleting: true });
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('삭제'));
    expect(screen.getByLabelText('삭제하기').props.accessibilityState?.disabled).toBe(true);
  });

  it('삭제 실패(deleteError)면 확인 시트에 인라인 에러를 표시한다(재시도 가능)', () => {
    renderManage({ canManage: true, deleteError: '삭제에 실패했어요.' });
    fireEvent.press(screen.getByLabelText('더보기'));
    fireEvent.press(screen.getByLabelText('삭제'));
    expect(screen.getByText('삭제에 실패했어요.')).toBeTruthy();
    // 시트는 유지(취소·삭제하기 모두 노출).
    expect(screen.getByLabelText('삭제하기')).toBeTruthy();
    expect(screen.getByLabelText('취소')).toBeTruthy();
  });

  it('공유(share) 버튼은 계속 미렌더한다', () => {
    renderManage({ canManage: true });
    expect(screen.queryByLabelText('공유')).toBeNull();
    expect(screen.queryByTestId('muklog-detail-share')).toBeNull();
  });
});

describe('MuklogDetailScreen — 작성자 라벨 (AC e, members 미로드 폴백)', () => {
  it('createdBy === meId & members 미로드([])면 "내가 기록" 폴백', () => {
    renderReady({ createdBy: 'me-uid' });
    expect(screen.getByText('내가 기록')).toBeTruthy();
  });

  it('createdBy !== meId & members 미로드면 "짝꿍이 기록" 폴백', () => {
    renderReady({ createdBy: 'partner-uid' });
    expect(screen.getByText('짝꿍이 기록')).toBeTruthy();
  });

  it('createdBy가 null(탈퇴자 익명화)이면 "탈퇴한 사용자"로 안전 표시한다 (AC6, 크래시 0)', () => {
    renderReady({ createdBy: null });
    // 익명 작성자 라벨 + 본인/짝꿍 라벨 부재(deleted 최우선 분기 — null===null 오판 차단).
    expect(screen.getByText('탈퇴한 사용자')).toBeTruthy();
    expect(screen.queryByText('내가 기록')).toBeNull();
    expect(screen.queryByText('짝꿍이 기록')).toBeNull();
  });
});

describe('MuklogDetailScreen — 작성자 실명 매핑 (S5b, T9)', () => {
  const members = [
    { userId: 'me-uid', nickname: '민지', avatarUrl: null },
    { userId: 'partner-uid', nickname: '지현', avatarUrl: 'https://cdn/p.jpg' },
    { userId: 'u3', nickname: '수달', avatarUrl: null },
  ];
  const renderWithMembers = (over?: Partial<MuklogDetailViewData>) =>
    renderWithTheme(
      <MuklogDetailScreen
        state={{ status: 'ready', muklog: data(over) }}
        meId="me-uid"
        meAvatarUrl={null}
        members={members}
        onBack={onBack}
        onRetry={onRetry}
      />,
    );

  it('멤버 매핑 시 작성자 라벨이 실 닉네임(내 글 → 내 닉)', () => {
    renderWithMembers({ createdBy: 'me-uid' });
    expect(screen.getByText('민지')).toBeTruthy();
    expect(screen.queryByText('내가 기록')).toBeNull();
  });

  it('짝꿍(3명+ 로그) 작성 글 → 실 닉(지현)·아바타 이미지 매핑', () => {
    renderWithMembers({ createdBy: 'partner-uid' });
    expect(screen.getByText('지현')).toBeTruthy();
    expect(screen.queryByText('짝꿍이 기록')).toBeNull();
    // avatarUrl 있음 → 이미지 아바타.
    expect(screen.getByTestId('avatar-image')).toBeTruthy();
  });

  it('세 번째 멤버(u3) 작성 글도 정확 매핑(수달) — me/partner 이분법 탈피', () => {
    renderWithMembers({ createdBy: 'u3' });
    expect(screen.getByText('수달')).toBeTruthy();
  });

  it('createdBy NULL은 members 무관 "탈퇴한 사용자"(회귀 0)', () => {
    renderWithMembers({ createdBy: null });
    expect(screen.getByText('탈퇴한 사용자')).toBeTruthy();
  });
});
