// src/features/room/useInviteShare/useInviteShare.spec.tsx
// 초대 공유·복사 훅 (invite-share U72·U23, plan R7 — AC5~AC9·AC23).
//   probe를 renderWithTheme(ToastProvider 포함)로 렌더해 전역 토스트를 화면에서 본다.
//   RN Share는 jest 기본 설정이 모킹하지 않는다 → spyOn으로 대체(대역은 실물 결과 모양을 따른다:
//   iOS 완료 = sharedAction + activityType · iOS 취소 = dismissedAction + null · Android = 항상 sharedAction + null).
//   연타 가드(AC8)는 1초 시간 창이다 — 공유 결과로 잠금을 풀지 않는다(iOS 완료 통지 누락, 리더 지시 2회차). 시계는 가짜 시간으로 넘긴다.
import React from 'react';
import { Platform, Share, type ShareAction } from 'react-native';
import { act, screen, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  hasStringAsync: jest.fn(),
}));
// 추가 네트워크 0(AC23) 가드 — 게이트 조회 함수와 supabase 클라이언트를 대역으로 두고 호출 0을 본다.
//   안쪽 파일을 모킹해 배럴(index.ts) 경유·직접 경로 import 모두 같은 대역으로 모인다.
jest.mock('@/features/appVersion/fetchAppConfig/fetchAppConfig', () => ({ fetchAppConfig: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

import * as Clipboard from 'expo-clipboard';
import { AppStoreLinksProvider } from '@/features/appVersion/appStoreLinks';
import { fetchAppConfig } from '@/features/appVersion/fetchAppConfig/fetchAppConfig';
import { supabase } from '@/lib/supabase';

import { buildInviteMessage, INVITE_STORE_URL_FALLBACK } from '../inviteMessage';
import { IOS_COPY_ACTIVITY_TYPE } from '../inviteShareFeedback';
import { useInviteShare } from './useInviteShare';

type InviteShareApi = ReturnType<typeof useInviteShare>;

const setStringAsync = Clipboard.setStringAsync as jest.Mock;
const fetchAppConfigMock = fetchAppConfig as jest.Mock;
const supabaseFrom = supabase.from as jest.Mock;
const supabaseRpc = supabase.rpc as jest.Mock;

const IOS_DISMISSED: ShareAction = { action: 'dismissedAction', activityType: null };

/** Platform.OS 조작(useAppVersionGate.spec 패턴). beforeEach가 ios로 되돌린다. */
const setPlatform = ({ os }: { os: 'ios' | 'android' }) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

/** 훅 반환을 받아 두는 probe — 렌더마다 최신 반환을 onReady로 넘긴다. */
const HookProbe = ({ onReady }: { onReady: (api: InviteShareApi) => void }) => {
  onReady(useInviteShare());
  return null;
};

/**
 * probe를 전역 토스트와 함께 렌더한다. storeUrlIos를 주면 AppStoreLinksProvider로 감싼다(없으면 Provider 밖).
 * @returns 최신 훅 반환을 꺼내는 함수
 */
const renderInviteShare = ({ storeUrlIos }: { storeUrlIos?: string | null } = {}) => {
  let latest: InviteShareApi | null = null;
  const probe = (
    <HookProbe
      onReady={(api) => {
        latest = api;
      }}
    />
  );
  renderWithTheme(
    storeUrlIos === undefined ? probe : <AppStoreLinksProvider storeUrlIos={storeUrlIos}>{probe}</AppStoreLinksProvider>,
  );
  const getApi = (): InviteShareApi => {
    if (latest === null) throw new Error('useInviteShare가 아직 렌더되지 않았다');
    return latest;
  };
  return { getApi };
};

const expectPositiveToast = ({ message }: { message: string }) => {
  const toast = screen.getByTestId('toast-pill');
  expect(within(toast).getByText(message)).toBeTruthy();
  expect(within(toast).getByText('✓')).toBeTruthy(); // positive만 ✓를 붙인다(Toast.tsx)
};

const expectNeutralToast = ({ message }: { message: string }) => {
  const toast = screen.getByTestId('toast-pill');
  expect(within(toast).getByText(message)).toBeTruthy();
  expect(within(toast).queryByText('✓')).toBeNull();
};

let shareSpy: jest.SpyInstance;

// 토스트 진입·자동 사라짐 타이머를 테스트 안에서 끝낸다(ToastProvider.spec 패턴) — 테스트 뒤 애니메이션 갱신 경고 방지.
//   공유·클립보드 대역은 Promise(마이크로태스크)라 가짜 시간과 무관하고, 즉시 실행 큐는 실제 시간이다(package.json doNotFake).
beforeEach(() => {
  jest.useFakeTimers();
  setPlatform({ os: 'ios' });
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue(IOS_DISMISSED);
  setStringAsync.mockReset();
  setStringAsync.mockResolvedValue(true);
  fetchAppConfigMock.mockReset();
  supabaseFrom.mockReset();
  supabaseRpc.mockReset();
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  shareSpy.mockRestore();
});

describe('useInviteShare — shareInvite (AC5 공유 호출)', () => {
  it('Provider 밖이면 폴백 링크로 만든 메시지 하나만 넘겨 Share.share를 1회 부른다(url 키·두 번째 인자 없음)', async () => {
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy.mock.calls).toStrictEqual([
      [{ message: buildInviteMessage({ code: 'K7P3AB', storeUrl: INVITE_STORE_URL_FALLBACK }) }],
    ]);
  });

  it('Provider가 준 https 링크를 메시지 마지막 줄에 싣는다', async () => {
    const { getApi } = renderInviteShare({ storeUrlIos: 'https://apps.apple.com/app/id1' });
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy.mock.calls).toStrictEqual([
      [{ message: '먹로그에서 우리 맛집 같이 기록해요\n초대코드: K7P3AB\n앱 받기: https://apps.apple.com/app/id1' }],
    ]);
  });

  it('Provider 링크가 https가 아니면 폴백 링크를 쓴다(링크 해석을 거친다)', async () => {
    const { getApi } = renderInviteShare({ storeUrlIos: 'http://x' });
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy.mock.calls).toStrictEqual([
      [{ message: buildInviteMessage({ code: 'K7P3AB', storeUrl: INVITE_STORE_URL_FALLBACK }) }],
    ]);
  });

  it('공유는 클립보드를 건드리지 않는다', async () => {
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(setStringAsync).not.toHaveBeenCalled();
  });
});

describe('useInviteShare — 공유 결과 피드백 (AC6)', () => {
  it('iOS 보내기 완료 → "초대 메시지를 보냈어요"(positive)', async () => {
    shareSpy.mockResolvedValue({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Message' });
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expectPositiveToast({ message: '초대 메시지를 보냈어요' });
  });

  it('iOS 공유 시트에서 "복사" → "초대 메시지를 복사했어요"(positive)', async () => {
    shareSpy.mockResolvedValue({ action: 'sharedAction', activityType: IOS_COPY_ACTIVITY_TYPE });
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expectPositiveToast({ message: '초대 메시지를 복사했어요' });
  });

  it('iOS 취소(dismissedAction) → 토스트 없음', async () => {
    shareSpy.mockResolvedValue(IOS_DISMISSED);
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(screen.queryByTestId('toast-pill')).toBeNull();
  });

  it('Android(항상 sharedAction) → 보냈는지 알 수 없어 토스트 없음', async () => {
    setPlatform({ os: 'android' });
    shareSpy.mockResolvedValue({ action: 'sharedAction', activityType: null });
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('toast-pill')).toBeNull();
  });
});

describe('useInviteShare — 공유 실패 (AC7)', () => {
  it('Share.share가 reject하면 "공유하지 못했어요. 다시 시도해 주세요."(neutral)를 띄우고 throw하지 않는다', async () => {
    shareSpy.mockRejectedValue(new Error('share sheet failed'));
    const { getApi } = renderInviteShare();
    await act(async () => {
      await expect(getApi().shareInvite({ code: 'K7P3AB' })).resolves.toBeUndefined();
    });
    expectNeutralToast({ message: '공유하지 못했어요. 다시 시도해 주세요.' });
  });
});

// 연타 가드(AC8)는 시간 창 잠금이다 — 마지막으로 공유 시트를 연 뒤 1초 안의 재호출만 무시한다.
//   공유 결과(promise)로는 잠금을 풀지 않는다. RN 0.76.9 iOS는 앱(메시지 등)을 고른 뒤 그 안에서 취소하면 완료 통지를 보내지 않아
//   (React/CoreModules/RCTActionSheetManager.mm:262-268 — completed || activityType == nil일 때만 알림) Share.share가 끝나지 않을 수 있다.
//   시계는 가짜 시간으로 넘긴다(jest.useFakeTimers는 Date.now도 함께 움직인다 — package.json fakeTimers는 즉시 실행 큐만 제외).
describe('useInviteShare — 연타 가드 (AC8 · 1초 시간 창)', () => {
  // 사용자에게 약속하는 값 — "1초 안의 연타는 한 번, 1초가 지나면 다시 연다". 제품 상수를 바꾸면 이 테스트도 함께 바꿔야 한다(의도한 변경만).
  const RETAP_WINDOW_MS = 1000;

  /** 공유 시트가 결과를 끝내 돌려주지 않는 상황(iOS 완료 통지 누락)을 흉내 낸다. */
  const shareNeverSettles = () => {
    shareSpy.mockImplementation(() => new Promise<ShareAction>(() => undefined));
  };

  /** 시계를 ms만큼 앞으로 보낸다. */
  const passTime = ({ ms }: { ms: number }) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  /** "공유"를 누른다 — 결과를 기다리지 않는다(끝나지 않는 공유에서도 테스트가 멈추지 않게). */
  const pressShare = ({ getApi }: { getApi: () => InviteShareApi }) => {
    act(() => {
      void getApi().shareInvite({ code: 'K7P3AB' });
    });
  };

  /**
   * 첫 공유의 결과를 붙잡아 두고 1초 뒤 두 번째 공유(끝나지 않음)를 연다 — 첫 공유의 결과만 늦게 도착하게 한다.
   * @returns 첫 공유 호출의 promise와 그 결과를 늦게 보내는 함수들
   */
  const openSecondShareBeforeFirstSettles = () => {
    let resolveFirst: (result: ShareAction) => void = () => undefined;
    let rejectFirst: (error: Error) => void = () => undefined;
    shareSpy
      .mockImplementationOnce(
        () =>
          new Promise<ShareAction>((resolve, reject) => {
            resolveFirst = resolve;
            rejectFirst = reject;
          }),
      )
      .mockImplementationOnce(() => new Promise<ShareAction>(() => undefined));
    const { getApi } = renderInviteShare();
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = getApi().shareInvite({ code: 'K7P3AB' });
    });
    passTime({ ms: RETAP_WINDOW_MS });
    pressShare({ getApi });
    // 전제: 첫 공유가 끝나지 않았어도 두 번째 공유 시트가 열렸다.
    expect(shareSpy).toHaveBeenCalledTimes(2);
    return {
      first,
      finishFirst: ({ result }: { result: ShareAction }) => resolveFirst(result),
      failFirst: ({ error }: { error: Error }) => rejectFirst(error),
    };
  };

  it('공유가 끝나지 않아도(완료 통지 누락) 1초가 지나면 다시 눌렀을 때 공유 시트를 다시 연다', () => {
    shareNeverSettles();
    const { getApi } = renderInviteShare();
    pressShare({ getApi });
    passTime({ ms: RETAP_WINDOW_MS });
    pressShare({ getApi });
    expect(shareSpy).toHaveBeenCalledTimes(2);
  });

  it('1초 안의 연타는 공유 시트를 한 번만 연다 — 곧바로 다시 눌러도, 0.999초 뒤에 눌러도', () => {
    shareNeverSettles();
    const { getApi } = renderInviteShare();
    pressShare({ getApi });
    pressShare({ getApi });
    passTime({ ms: RETAP_WINDOW_MS - 1 });
    pressShare({ getApi });
    expect(shareSpy).toHaveBeenCalledTimes(1);
  });

  // Android는 선택 화면을 연 직후 결과가 온다(ShareModule.kt) — 결과로 잠금을 풀면 그 사이 두 번째 탭이 선택 화면을 한 번 더 띄운다.
  it('첫 공유가 이미 끝났어도 1초 안의 재호출은 무시한다 — 공유 결과로 잠금을 풀지 않는다', async () => {
    setPlatform({ os: 'android' });
    shareSpy.mockResolvedValue({ action: 'sharedAction', activityType: null });
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy).toHaveBeenCalledTimes(1);
  });

  it('무시된 누름은 창을 늘리지 않는다 — 계속 눌러도 처음 연 때부터 1초가 지나면 다시 연다', () => {
    shareNeverSettles();
    const { getApi } = renderInviteShare();
    pressShare({ getApi });
    passTime({ ms: 600 });
    pressShare({ getApi }); // 무시된다 — 창을 이 시각부터 다시 세지 않는다
    passTime({ ms: RETAP_WINDOW_MS - 600 });
    pressShare({ getApi });
    expect(shareSpy).toHaveBeenCalledTimes(2);
  });

  it('기기 시계가 뒤로 가도 잠기지 않는다 — 시각이 거꾸로 흐르면 창이 지난 것으로 본다', () => {
    shareNeverSettles();
    const { getApi } = renderInviteShare();
    pressShare({ getApi });
    act(() => {
      jest.setSystemTime(Date.now() - 60_000);
    });
    pressShare({ getApi });
    expect(shareSpy).toHaveBeenCalledTimes(2);
  });

  it('공유가 실패해도 1초가 지나면 다시 공유할 수 있다', async () => {
    shareSpy.mockRejectedValueOnce(new Error('share sheet failed'));
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    passTime({ ms: RETAP_WINDOW_MS });
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
    });
    expect(shareSpy).toHaveBeenCalledTimes(2);
  });

  it('첫 공유가 1초 뒤에 늦게 "보내기 완료"로 끝나도 기존 규칙대로 "초대 메시지를 보냈어요"(positive)를 띄운다', async () => {
    const late = openSecondShareBeforeFirstSettles();
    await act(async () => {
      late.finishFirst({ result: { action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Message' } });
      await late.first;
    });
    expectPositiveToast({ message: '초대 메시지를 보냈어요' });
  });

  it('첫 공유가 늦게 취소로 끝나면 기존 규칙대로 토스트가 없다', async () => {
    const late = openSecondShareBeforeFirstSettles();
    await act(async () => {
      late.finishFirst({ result: IOS_DISMISSED });
      await late.first;
    });
    expect(screen.queryByTestId('toast-pill')).toBeNull();
  });

  it('첫 공유가 늦게 실패하면 기존 규칙대로 "공유하지 못했어요. 다시 시도해 주세요."(neutral)를 띄우고 throw하지 않는다', async () => {
    const late = openSecondShareBeforeFirstSettles();
    await act(async () => {
      late.failFirst({ error: new Error('share sheet failed') });
      await expect(late.first).resolves.toBeUndefined();
    });
    expectNeutralToast({ message: '공유하지 못했어요. 다시 시도해 주세요.' });
  });
});

describe('useInviteShare — copyInviteCode (AC9 · U23)', () => {
  it('코드 6자만 클립보드에 넣고 "초대코드를 복사했어요"(positive)를 띄운다', async () => {
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().copyInviteCode({ code: 'K7P3AB' });
    });
    expect(setStringAsync.mock.calls).toStrictEqual([['K7P3AB']]);
    expectPositiveToast({ message: '초대코드를 복사했어요' });
  });

  it('클립보드가 false를 돌려주면 "초대코드를 복사하지 못했어요. 다시 시도해 주세요."(neutral)', async () => {
    setStringAsync.mockResolvedValue(false);
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().copyInviteCode({ code: 'K7P3AB' });
    });
    expectNeutralToast({ message: '초대코드를 복사하지 못했어요. 다시 시도해 주세요.' });
    expect(screen.queryByText('초대코드를 복사했어요')).toBeNull();
  });

  it('클립보드가 reject하면 같은 실패 토스트를 띄우고 throw하지 않는다', async () => {
    setStringAsync.mockRejectedValue(new Error('clipboard failed'));
    const { getApi } = renderInviteShare();
    await act(async () => {
      await expect(getApi().copyInviteCode({ code: 'K7P3AB' })).resolves.toBeUndefined();
    });
    expectNeutralToast({ message: '초대코드를 복사하지 못했어요. 다시 시도해 주세요.' });
  });

  it('복사는 공유 시트를 열지 않는다', async () => {
    const { getApi } = renderInviteShare();
    await act(async () => {
      await getApi().copyInviteCode({ code: 'K7P3AB' });
    });
    expect(shareSpy).not.toHaveBeenCalled();
  });
});

describe('useInviteShare — 추가 네트워크 0 (AC23)', () => {
  it('공유·복사를 모두 해도 게이트 조회(fetchAppConfig)·supabase 호출이 없다', async () => {
    shareSpy.mockResolvedValue({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.Message' });
    const { getApi } = renderInviteShare({ storeUrlIos: 'https://apps.apple.com/app/id1' });
    await act(async () => {
      await getApi().shareInvite({ code: 'K7P3AB' });
      await getApi().copyInviteCode({ code: 'K7P3AB' });
    });
    expect(fetchAppConfigMock).not.toHaveBeenCalled();
    expect(supabaseFrom).not.toHaveBeenCalled();
    expect(supabaseRpc).not.toHaveBeenCalled();
  });
});
