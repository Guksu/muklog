// src/features/appVersion/currentAppVersion/currentAppVersion.spec.ts
// 현재 앱 버전 취득 단위 테스트 (app-version-gate plan §5 T6 일부·§5-1).
//   expo-constants 모킹 — expoConfig.version 반환 / expoConfig 결측·version 결측 시 null(fail-open).
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
import Constants from 'expo-constants';
import { getCurrentAppVersion } from './currentAppVersion';

// 모킹된 default 객체를 케이스별로 조작(expoConfig 결측/version 결측 시나리오).
const mocked = Constants as unknown as { expoConfig: { version?: string } | null };

afterEach(() => {
  mocked.expoConfig = { version: '1.0.0' };
});

describe('getCurrentAppVersion (T6)', () => {
  it('Constants.expoConfig.version을 반환한다', () => {
    mocked.expoConfig = { version: '1.2.3' };
    expect(getCurrentAppVersion()).toBe('1.2.3');
  });

  it('expoConfig가 없으면 null(fail-open)', () => {
    mocked.expoConfig = null;
    expect(getCurrentAppVersion()).toBeNull();
  });

  it('version이 없으면 null(fail-open)', () => {
    mocked.expoConfig = {};
    expect(getCurrentAppVersion()).toBeNull();
  });
});
