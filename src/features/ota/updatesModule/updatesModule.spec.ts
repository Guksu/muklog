// src/features/ota/updatesModule/updatesModule.spec.ts
// expo-updates 안전 로더 단위 테스트 (expo-updates-ota plan §3.3, T3 · §5-1).
//   usePushReceive(S1) probe 패턴 준용 — 네이티브 미탑재면 SDK require 자체를 하지 않는다(현 Dev Client 크래시 방지).
//   외부 SDK 동작은 검증 대상 아님. 우리 코드의 probe 이름·require 접촉 여부·실패 흡수만 본다.
import { readFileSync } from 'fs';
import { join } from 'path';

const mockRequireOptionalNativeModule = jest.fn();
jest.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: mockRequireOptionalNativeModule,
}));

// require 접촉 여부를 관찰하기 위한 추적기 — 모듈 레지스트리 리셋(jest.resetModules) 시 팩토리가 재실행된다.
const mockRequireTracker = { count: 0, shouldThrow: false };
const mockUpdates = {
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
};
jest.mock('expo-updates', () => {
  mockRequireTracker.count += 1;
  if (mockRequireTracker.shouldThrow) throw new Error('네이티브 모듈 로드 실패(테스트)');
  return mockUpdates;
});

// 모듈 레지스트리를 매번 리셋해 "require를 몇 번 접촉했는가"를 케이스별로 관찰한다.
const loadFresh = () => {
  jest.resetModules();
  mockRequireTracker.count = 0;
  return (require('./updatesModule') as typeof import('./updatesModule')).loadUpdatesModule();
};

beforeEach(() => {
  mockRequireOptionalNativeModule.mockReset();
  mockRequireOptionalNativeModule.mockReturnValue({}); // 기본 탑재.
  mockRequireTracker.shouldThrow = false;
});

describe('loadUpdatesModule (T3)', () => {
  it('네이티브 probe 대상은 expo-updates가 선언한 실제 모듈명 ExpoUpdates다', () => {
    loadFresh();
    expect(mockRequireOptionalNativeModule).toHaveBeenCalledWith('ExpoUpdates');
  });

  it('probe null(미탑재) → null 반환 + expo-updates require 미접촉(SDK 접촉 0)', () => {
    mockRequireOptionalNativeModule.mockReturnValue(null);
    expect(loadFresh()).toBeNull();
    expect(mockRequireTracker.count).toBe(0);
  });

  it('probe 자체가 throw → null(예외가 밖으로 나가지 않음)', () => {
    mockRequireOptionalNativeModule.mockImplementation(() => {
      throw new Error('probe 실패');
    });
    expect(() => loadFresh()).not.toThrow();
    expect(loadFresh()).toBeNull();
  });

  it('probe 성공 + require throw → null(예외 흡수)', () => {
    mockRequireTracker.shouldThrow = true;
    let result: unknown;
    expect(() => {
      result = loadFresh();
    }).not.toThrow();
    expect(result).toBeNull();
    expect(mockRequireTracker.count).toBe(1); // require는 시도했다.
  });

  it('정상 → 이 기능이 쓰는 4개 표면(isEnabled·check·fetch·reload)을 가진 객체', async () => {
    mockUpdates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockUpdates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    mockUpdates.reloadAsync.mockResolvedValue(undefined);

    const updates = loadFresh();
    expect(updates).not.toBeNull();
    expect(updates?.isEnabled).toBe(true);
    await expect(updates?.checkForUpdateAsync()).resolves.toEqual({ isAvailable: true });
    await expect(updates?.fetchUpdateAsync()).resolves.toEqual({ isNew: true });
    await expect(updates?.reloadAsync()).resolves.toBeUndefined();
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('소스에 expo-updates top-level import가 없다(네이티브 모듈 lazy require 규칙)', () => {
    const source = readFileSync(join(__dirname, 'updatesModule.ts'), 'utf8');
    // 값 import만 금지 — `typeof import('expo-updates')`(타입 전용)은 런타임 로드를 유발하지 않는다.
    expect(source).not.toMatch(/^\s*import\s[^\n]*from\s+'expo-updates'/m);
  });
});
