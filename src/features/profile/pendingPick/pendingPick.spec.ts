// src/features/profile/pendingPick.spec.ts
// picker 컨텍스트 영속 (picker-recovery AC1) — save/load/clear 라이프사이클·잘못된 형 방어.
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();
const mockRemoveItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...a: unknown[]) => mockSetItem(...a),
    getItem: (...a: unknown[]) => mockGetItem(...a),
    removeItem: (...a: unknown[]) => mockRemoveItem(...a),
  },
}));

import {
  PENDING_PICK_KEY,
  PendingPickKind,
  savePendingPick,
  loadPendingPick,
  clearPendingPick,
} from './pendingPick';

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
  mockRemoveItem.mockResolvedValue(undefined);
});

describe('pendingPick (AC1)', () => {
  it('savePendingPick는 PENDING_PICK_KEY에 JSON 컨텍스트를 저장한다', async () => {
    await savePendingPick({ context: { kind: PendingPickKind.Avatar, userId: 'u1' } });
    expect(mockSetItem).toHaveBeenCalledWith(
      PENDING_PICK_KEY,
      JSON.stringify({ kind: 'avatar', userId: 'u1' }),
    );
  });

  it('clearPendingPick는 키를 제거한다', async () => {
    await clearPendingPick();
    expect(mockRemoveItem).toHaveBeenCalledWith(PENDING_PICK_KEY);
  });

  it('loadPendingPick는 저장된 avatar 컨텍스트를 복원한다', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ kind: 'avatar', userId: 'u1' }));
    await expect(loadPendingPick()).resolves.toEqual({ kind: 'avatar', userId: 'u1' });
  });

  it('값이 없으면 null', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await expect(loadPendingPick()).resolves.toBeNull();
  });

  it('JSON 파싱 실패면 null(throw 안 함)', async () => {
    mockGetItem.mockResolvedValueOnce('{not json');
    await expect(loadPendingPick()).resolves.toBeNull();
  });

  it('kind/userId가 형에 안 맞으면 null', async () => {
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ kind: 'muklog', roomId: 'r1' }));
    await expect(loadPendingPick()).resolves.toBeNull();

    mockGetItem.mockResolvedValueOnce(JSON.stringify({ kind: 'avatar', userId: '' }));
    await expect(loadPendingPick()).resolves.toBeNull();
  });
});
