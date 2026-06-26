// src/features/profile/useRecoverPendingPick.spec.tsx
// 유실 picker 결과 복구 (picker-recovery AC2·AC3·AC4) — getPendingResultAsync / pendingPick / upload / toast 모킹.
import { act, renderHook, waitFor } from '@testing-library/react-native';

// --- expo-image-picker.getPendingResultAsync ---
jest.mock('expo-image-picker', () => ({ getPendingResultAsync: jest.fn() }));
import * as ImagePicker from 'expo-image-picker';
const getPending = ImagePicker.getPendingResultAsync as jest.Mock;

// --- pendingPick(컨텍스트 영속) — AsyncStorage 네이티브 미연결 회피로 전체 모킹(상수만 재현) ---
jest.mock('./pendingPick', () => ({
  PendingPickKind: { Avatar: 'avatar' },
  loadPendingPick: jest.fn(),
  clearPendingPick: jest.fn(),
}));
import { loadPendingPick, clearPendingPick } from './pendingPick';
const load = loadPendingPick as jest.Mock;
const clear = clearPendingPick as jest.Mock;

// --- 업로드 공용 함수 ---
jest.mock('./uploadAvatarFromUri', () => ({ uploadAvatarFromUri: jest.fn() }));
import { uploadAvatarFromUri } from './uploadAvatarFromUri';
const upload = uploadAvatarFromUri as jest.Mock;

// --- 전역 토스트 ---
const mockShowToast = jest.fn();
jest.mock('@/components', () => ({ useToastController: () => ({ showToast: mockShowToast }) }));

import { useRecoverPendingPick, PICK_RECOVERED_TOAST } from './useRecoverPendingPick';

const SUCCESS = [{ canceled: false, assets: [{ uri: 'file:///recovered.jpg' }] }];

beforeEach(() => {
  jest.clearAllMocks();
  clear.mockResolvedValue(undefined);
  upload.mockResolvedValue({ avatarUrl: 'https://x/new.jpg' });
});

describe('useRecoverPendingPick (AC2·AC3·AC4)', () => {
  it('AC2 유실 결과 + avatar 컨텍스트 → upload → refresh → 토스트, 컨텍스트 제거', async () => {
    getPending.mockResolvedValue(SUCCESS);
    load.mockResolvedValue({ kind: 'avatar', userId: 'u1' });
    const refresh = jest.fn().mockResolvedValue(undefined);

    renderHook(() => useRecoverPendingPick({ refresh }));

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith({ uri: 'file:///recovered.jpg', userId: 'u1' }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith({
        message: PICK_RECOVERED_TOAST,
        tone: 'positive',
      }),
    );
    expect(clear).toHaveBeenCalled();
  });

  it('AC3 결과 없음(정상·iOS) → no-op, 업로드/refresh/토스트 0', async () => {
    getPending.mockResolvedValue([]);
    load.mockResolvedValue(null);
    const refresh = jest.fn();

    renderHook(() => useRecoverPendingPick({ refresh }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(upload).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it('AC4 결과는 있는데 컨텍스트 없음 → 업로드 0(잘못된 업로드 방지)', async () => {
    getPending.mockResolvedValue(SUCCESS);
    load.mockResolvedValue(null);
    const refresh = jest.fn();

    renderHook(() => useRecoverPendingPick({ refresh }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('AC4 canceled 결과 → 업로드 0, 컨텍스트만 정리', async () => {
    getPending.mockResolvedValue([{ canceled: true, assets: null }]);
    load.mockResolvedValue({ kind: 'avatar', userId: 'u1' });
    const refresh = jest.fn();

    renderHook(() => useRecoverPendingPick({ refresh }));

    await waitFor(() => expect(clear).toHaveBeenCalled());
    expect(upload).not.toHaveBeenCalled();
  });

  it('에러결과(code/message)는 무시한다', async () => {
    getPending.mockResolvedValue([{ code: 'E', message: 'boom' }]);
    load.mockResolvedValue({ kind: 'avatar', userId: 'u1' });
    const refresh = jest.fn();

    renderHook(() => useRecoverPendingPick({ refresh }));

    await waitFor(() => expect(clear).toHaveBeenCalled());
    expect(upload).not.toHaveBeenCalled();
  });
});
