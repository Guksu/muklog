// src/features/map/lastKnownLocation/lastKnownLocation.spec.ts
// OS 캐시 위치(last-known) 선취득 모듈 단위 테스트 (map-initial-location plan §3.2·§5-1 T2).
//   급소: 권한 미허용이면 위치 API를 "호출조차" 하지 않는다(E1 — 앱 구동 시 권한 프롬프트 0).
//   네이티브는 모킹 → 우리 코드의 권한 게이트·인자 계약·매핑·이상치 차단·멱등·throw 흡수만 검증한다.
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

import * as Location from 'expo-location';

import {
  LAST_KNOWN_MAX_AGE_MS,
  LAST_KNOWN_REQUIRED_ACCURACY_M,
  clearWarmCoords,
  readWarmCoords,
  warmLastKnownLocation,
  writeWarmCoords,
} from './lastKnownLocation';

const getPermissionsMock = Location.getForegroundPermissionsAsync as jest.Mock;
const getLastKnownMock = Location.getLastKnownPositionAsync as jest.Mock;

const grant = () => getPermissionsMock.mockResolvedValue({ granted: true, status: 'granted' });
const deny = () => getPermissionsMock.mockResolvedValue({ granted: false, status: 'denied' });

beforeEach(() => {
  getPermissionsMock.mockReset();
  getLastKnownMock.mockReset();
  // 모듈 캐시는 프로세스 수명 — 케이스 간 격리를 위해 매번 비운다.
  clearWarmCoords();
});

describe('lastKnownLocation', () => {
  it('granted + 위치 반환 시 캐시에 적재하고 좌표를 반환한다', async () => {
    grant();
    getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });

    const warmed = await warmLastKnownLocation();

    expect(warmed).toEqual({ lat: 37.55, lng: 126.99 });
    expect(readWarmCoords()).toEqual({ lat: 37.55, lng: 126.99 });
  });

  it('getLastKnownPositionAsync를 {maxAge, requiredAccuracy} 계약대로 호출한다', async () => {
    grant();
    getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });

    await warmLastKnownLocation();

    expect(getLastKnownMock).toHaveBeenCalledTimes(1);
    expect(getLastKnownMock).toHaveBeenCalledWith({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
    });
    expect(LAST_KNOWN_MAX_AGE_MS).toBe(3_600_000);
    expect(LAST_KNOWN_REQUIRED_ACCURACY_M).toBe(1000);
  });

  it('E1: 권한 denied면 위치 API를 호출조차 하지 않고 null을 반환한다', async () => {
    deny();

    const warmed = await warmLastKnownLocation();

    expect(warmed).toBeNull();
    expect(getLastKnownMock).not.toHaveBeenCalled();
    expect(readWarmCoords()).toBeNull();
  });

  it('E1: 권한 undetermined(미결정)여도 위치 API 미호출 — 프롬프트 트리거 0', async () => {
    getPermissionsMock.mockResolvedValue({ granted: false, status: 'undetermined' });

    const warmed = await warmLastKnownLocation();

    expect(warmed).toBeNull();
    expect(getLastKnownMock).not.toHaveBeenCalled();
  });

  // E1 정적 검사 — 워밍 경로 "전체"를 잠근다(qa-report-logic L3: 이전엔 이 파일 1개만 커버했다).
  //   경로 어느 한 파일에라도 request 계열이 들어가면 앱 구동 시 권한 팝업이 뜬다(§7 경계면 4).
  //   대상 2파일: 워밍을 수행하는 모듈 + 그것을 앱 구동 시 호출하는 컴포넌트.
  const WARMING_PATH_FILES = [
    { path: `${__dirname}/lastKnownLocation.ts`, label: 'lastKnownLocation.ts' },
    { path: `${__dirname}/../LocationPrewarm/LocationPrewarm.tsx`, label: 'LocationPrewarm.tsx' },
  ];
  // 프롬프트를 띄우거나 GPS를 깨우는 API — 워밍 경로에서 사용 금지.
  const FORBIDDEN_IN_WARMING = [
    'requestForegroundPermissionsAsync',
    'requestBackgroundPermissionsAsync',
    'getCurrentPositionAsync',
    'watchPositionAsync',
  ];

  it.each(WARMING_PATH_FILES)(
    'E1: $label이 권한 요청·GPS 기동 API를 사용하지 않는다 (정적 검사)',
    ({ path: filePath }) => {
      const fs = require('fs') as typeof import('fs');
      const source = fs.readFileSync(filePath, 'utf8');
      // 주석(설명)은 제외하고 실제 코드만 검사한다 — 라인(//)·블록(/* */) 주석 모두 제거해 위양성 0.
      const codeOnly = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, ''))
        .join('\n');
      FORBIDDEN_IN_WARMING.forEach((identifier) => {
        expect(codeOnly).not.toMatch(new RegExp(identifier));
      });
    },
  );

  it('OS 마지막 위치가 없으면(null) 캐시 미적재·null 반환(예외 0) — E3', async () => {
    grant();
    getLastKnownMock.mockResolvedValue(null);

    const warmed = await warmLastKnownLocation();

    expect(warmed).toBeNull();
    expect(readWarmCoords()).toBeNull();
  });

  it('좌표가 NaN/Infinity/누락이면 캐시에 적재하지 않는다 — E6 이상치 차단', async () => {
    grant();
    const invalids = [
      { coords: { latitude: Number.NaN, longitude: 126.99 } },
      { coords: { latitude: 37.55, longitude: Number.POSITIVE_INFINITY } },
      { coords: {} },
      { coords: null },
      {},
    ];

    for (const position of invalids) {
      getLastKnownMock.mockResolvedValueOnce(position);
      const warmed = await warmLastKnownLocation();
      expect(warmed).toBeNull();
      expect(readWarmCoords()).toBeNull();
    }
  });

  it('연속 호출 시 이미 캐시가 있으면 네이티브를 다시 호출하지 않는다(멱등)', async () => {
    grant();
    getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });

    await warmLastKnownLocation();
    await warmLastKnownLocation();

    expect(getLastKnownMock).toHaveBeenCalledTimes(1);
    expect(getPermissionsMock).toHaveBeenCalledTimes(1);
  });

  it('E8: 동시 호출(in-flight)이어도 네이티브 호출은 1회다', async () => {
    grant();
    let resolveLastKnown: (value: unknown) => void = () => {};
    getLastKnownMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLastKnown = resolve;
      }),
    );

    const first = warmLastKnownLocation();
    const second = warmLastKnownLocation();
    resolveLastKnown({ coords: { latitude: 37.55, longitude: 126.99 } });
    const [a, b] = await Promise.all([first, second]);

    expect(getLastKnownMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ lat: 37.55, lng: 126.99 });
    expect(b).toEqual({ lat: 37.55, lng: 126.99 });
  });

  it('권한 getter가 throw하면 null 반환·예외 전파 0', async () => {
    getPermissionsMock.mockRejectedValue(new Error('perm boom'));

    await expect(warmLastKnownLocation()).resolves.toBeNull();
    expect(getLastKnownMock).not.toHaveBeenCalled();
  });

  it('위치 getter가 throw하면 null 반환·예외 전파 0', async () => {
    grant();
    getLastKnownMock.mockRejectedValue(new Error('location boom'));

    await expect(warmLastKnownLocation()).resolves.toBeNull();
    expect(readWarmCoords()).toBeNull();
  });

  it('expo-location 모듈이 없어도(네이티브 미탑재) 조용히 null을 반환한다', async () => {
    getPermissionsMock.mockImplementation(() => {
      throw new TypeError('null is not an object');
    });

    await expect(warmLastKnownLocation()).resolves.toBeNull();
  });

  describe('캐시 read/write/clear', () => {
    it('writeWarmCoords → readWarmCoords 왕복', () => {
      writeWarmCoords({ coords: { lat: 37.1, lng: 127.1 } });
      expect(readWarmCoords()).toEqual({ lat: 37.1, lng: 127.1 });
    });

    it('writeWarmCoords가 캐시를 최신 좌표로 갱신한다(fresh 승격)', () => {
      writeWarmCoords({ coords: { lat: 37.1, lng: 127.1 } });
      writeWarmCoords({ coords: { lat: 37.2, lng: 127.2 } });
      expect(readWarmCoords()).toEqual({ lat: 37.2, lng: 127.2 });
    });

    it('이상치(NaN)는 writeWarmCoords로도 적재되지 않는다', () => {
      writeWarmCoords({ coords: { lat: Number.NaN, lng: 127.1 } });
      expect(readWarmCoords()).toBeNull();
    });

    it('clearWarmCoords가 캐시를 비운다(권한 취소 시 stale 좌표 차단 — E7)', () => {
      writeWarmCoords({ coords: { lat: 37.1, lng: 127.1 } });
      clearWarmCoords();
      expect(readWarmCoords()).toBeNull();
    });

    it('clear 이후에는 네이티브를 다시 호출할 수 있다(캐시 무효화 후 재취득)', async () => {
      grant();
      getLastKnownMock.mockResolvedValue({ coords: { latitude: 37.55, longitude: 126.99 } });
      await warmLastKnownLocation();
      clearWarmCoords();

      await warmLastKnownLocation();

      expect(getLastKnownMock).toHaveBeenCalledTimes(2);
    });
  });
});
