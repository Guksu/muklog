// src/lib/secureStorage.spec.ts
// createSecureStorage — SecureStore 기반 supabase auth storage 어댑터 단위 명세.
//   검증 경계: 청킹(2KB 제한 회피)·라운드트립·overwrite 시 stale 청크 제거·remove·레거시(AsyncStorage) 마이그레이션.
//   실제 expo-secure-store/AsyncStorage 는 주입(DI)한 페이크로 대체 — 네이티브 동작은 디바이스 스모크 몫.
import { createSecureStorage, SECURE_CHUNK_SIZE } from './secureStorage';

// Map 기반 SecureStore 페이크(expo-secure-store getItemAsync/setItemAsync/deleteItemAsync 시그니처).
const makeSecureFake = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItemAsync: (key: string) => Promise.resolve(map.has(key) ? (map.get(key) as string) : null),
    setItemAsync: (key: string, value: string) => {
      map.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
};

// Map 기반 레거시(AsyncStorage) 페이크 — getItem/removeItem 만 사용.
const makeLegacyFake = (seed?: Record<string, string>) => {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    getItem: (key: string) => Promise.resolve(map.has(key) ? (map.get(key) as string) : null),
    removeItem: (key: string) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
};

const KEY = 'sb-abcdefgh-auth-token';

describe('createSecureStorage — 라운드트립·청킹', () => {
  it('작은 값 set→get 라운드트립', async () => {
    const secure = makeSecureFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: makeLegacyFake() });
    await storage.setItem(KEY, 'hello-session');
    expect(await storage.getItem(KEY)).toBe('hello-session');
  });

  it('2KB 초과 값은 여러 청크로 분할 저장되고 정확히 재조립된다', async () => {
    const secure = makeSecureFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: makeLegacyFake() });
    const big = 'x'.repeat(SECURE_CHUNK_SIZE * 2 + 123); // 3청크 필요
    await storage.setItem(KEY, big);

    // 개별 청크는 모두 제한 이하.
    for (const [k, v] of secure.map) {
      if (k.includes('.')) expect(v.length).toBeLessThanOrEqual(SECURE_CHUNK_SIZE);
    }
    // 최소 3개의 청크 키가 존재.
    const chunkKeys = [...secure.map.keys()].filter((k) => k.startsWith(`${KEY}.`));
    expect(chunkKeys.length).toBeGreaterThanOrEqual(3);
    // 재조립 정확.
    expect(await storage.getItem(KEY)).toBe(big);
  });

  it('큰 값을 작은 값으로 덮어쓰면 stale 청크가 남지 않는다', async () => {
    const secure = makeSecureFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: makeLegacyFake() });
    await storage.setItem(KEY, 'y'.repeat(SECURE_CHUNK_SIZE * 3));
    await storage.setItem(KEY, 'small');

    expect(await storage.getItem(KEY)).toBe('small');
    const chunkKeys = [...secure.map.keys()].filter((k) => k.startsWith(`${KEY}.`));
    expect(chunkKeys.length).toBe(1); // 작은 값은 청크 1개
  });

  it('removeItem 은 모든 청크와 카운트를 지운다', async () => {
    const secure = makeSecureFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: makeLegacyFake() });
    await storage.setItem(KEY, 'z'.repeat(SECURE_CHUNK_SIZE * 2));
    await storage.removeItem(KEY);

    expect(await storage.getItem(KEY)).toBeNull();
    expect(secure.map.size).toBe(0);
  });

  it('없는 키는 null', async () => {
    const secure = makeSecureFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: makeLegacyFake() });
    expect(await storage.getItem(KEY)).toBeNull();
  });
});

describe('createSecureStorage — 레거시(AsyncStorage) 마이그레이션', () => {
  it('SecureStore 미보유 + 레거시 보유 → 값 반환 + SecureStore 로 이관 + 레거시 제거', async () => {
    const secure = makeSecureFake();
    const legacy = makeLegacyFake({ [KEY]: 'legacy-session' });
    const storage = createSecureStorage({ secureStore: secure, legacyStore: legacy });

    // 첫 조회에서 마이그레이션.
    expect(await storage.getItem(KEY)).toBe('legacy-session');
    // 레거시에서 제거됨(중복 잔존 방지).
    expect(legacy.map.has(KEY)).toBe(false);
    // 이후 조회는 SecureStore 에서(레거시 비어도 유지).
    expect(await storage.getItem(KEY)).toBe('legacy-session');
  });

  it('둘 다 없으면 null (마이그레이션 없음)', async () => {
    const secure = makeSecureFake();
    const legacy = makeLegacyFake();
    const storage = createSecureStorage({ secureStore: secure, legacyStore: legacy });
    expect(await storage.getItem(KEY)).toBeNull();
    expect(secure.map.size).toBe(0);
  });
});
