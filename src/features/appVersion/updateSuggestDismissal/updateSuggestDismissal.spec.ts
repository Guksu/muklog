// src/features/appVersion/updateSuggestDismissal/updateSuggestDismissal.spec.ts
// 업데이트 권유 dismiss 저장 단위 테스트 (app-version-gate plan §5 T5·§5-1).
//   save→load 왕복(버전 문자열) / 미저장·빈값·예외 → null(폴백). AsyncStorage 모킹(pendingPick 패턴).
const mockSetItem = jest.fn();
const mockGetItem = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: (...a: unknown[]) => mockSetItem(...a),
    getItem: (...a: unknown[]) => mockGetItem(...a),
  },
}));

import {
  UPDATE_SUGGEST_DISMISSED_KEY,
  loadDismissedVersion,
  saveDismissedVersion,
} from './updateSuggestDismissal';

beforeEach(() => {
  jest.clearAllMocks();
  mockSetItem.mockResolvedValue(undefined);
});

describe('updateSuggestDismissal (T5)', () => {
  it('saveDismissedVersion은 키에 버전 문자열을 저장한다', async () => {
    await saveDismissedVersion({ version: '2.0.0' });
    expect(mockSetItem).toHaveBeenCalledWith(UPDATE_SUGGEST_DISMISSED_KEY, '2.0.0');
  });

  it('save→load 왕복 — 저장한 버전을 그대로 복원한다', async () => {
    mockGetItem.mockResolvedValueOnce('2.0.0');
    await expect(loadDismissedVersion()).resolves.toBe('2.0.0');
  });

  it('미저장(키 없음)이면 null', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    await expect(loadDismissedVersion()).resolves.toBeNull();
  });

  it('빈 문자열이면 null', async () => {
    mockGetItem.mockResolvedValueOnce('');
    await expect(loadDismissedVersion()).resolves.toBeNull();
  });

  it('getItem 예외가 나도 null로 흡수한다(throw 0)', async () => {
    mockGetItem.mockRejectedValueOnce(new Error('storage down'));
    await expect(loadDismissedVersion()).resolves.toBeNull();
  });
});
