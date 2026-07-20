// src/lib/secureStorage.ts
// supabase auth storage 어댑터 — expo-secure-store(Keychain/Keystore) 기반.
//   AsyncStorage 평문 저장(루팅/백업 추출로 세션 탈취 가능)을 하드웨어 보호 스토리지로 대체한다.
//
// 두 가지 네이티브 제약을 흡수한다:
//   1) 청킹 — SecureStore 는 Android 에서 값 1개당 약 2KB 제한. supabase 세션(JWT+refresh)은 이를 넘길 수 있어
//      값을 SECURE_CHUNK_SIZE 로 쪼개 `${key}.N` 에 저장하고, `${key}` 에는 청크 개수만 둔다.
//   2) 마이그레이션 — 기존 사용자는 세션이 AsyncStorage(레거시)에 있다. SecureStore 미보유 시 레거시를 조회해
//      값을 SecureStore 로 이관하고 레거시에서 지운다 → 업데이트 후에도 로그인 유지(강제 로그아웃 회피).
//
// ⚠️ 순수 로직만 담아 DI(주입) 로 단위 테스트한다. 실제 expo-secure-store/AsyncStorage 배선은 lib/supabase 에서.
//    네이티브 실동작(Keystore 가용성·용량)은 디바이스 스모크 몫(testing-strategy 경계).

/** expo-secure-store 최소 시그니처(주입 대상). */
export type SecureStoreLike = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

/** 레거시 저장소(AsyncStorage) 최소 시그니처 — 마이그레이션 읽기/삭제만. */
export type LegacyStoreLike = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
};

/** supabase auth 가 기대하는 storage 인터페이스. */
export type SupabaseStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// SecureStore Android 값 제한(~2048B) 아래로 여유를 둔 청크 크기. supabase 세션은 ASCII(JWT/base64)라 길이≈바이트.
export const SECURE_CHUNK_SIZE = 1800;

// 청크 개수를 담는 메타 키(=원본 키) / N번째 청크 키.
const chunkKey = ({ key, index }: { key: string; index: number }): string => `${key}.${index}`;

/** 값을 SECURE_CHUNK_SIZE 단위로 분할. 빈 문자열도 청크 1개('')로 취급(멱등 재조립). */
const splitChunks = ({ value }: { value: string }): string[] => {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += SECURE_CHUNK_SIZE) {
    chunks.push(value.slice(start, start + SECURE_CHUNK_SIZE));
  }
  return chunks;
};

/**
 * SecureStore 기반 supabase storage 어댑터를 만든다.
 * @param secureStore 주입된 SecureStore(expo-secure-store)
 * @param legacyStore 주입된 레거시 저장소(AsyncStorage) — 최초 1회 마이그레이션 소스
 * @returns supabase auth.storage 로 넘길 { getItem, setItem, removeItem }
 */
export const createSecureStorage = ({
  secureStore,
  legacyStore,
}: {
  secureStore: SecureStoreLike;
  legacyStore: LegacyStoreLike;
}): SupabaseStorage => {
  // 원본 키에 저장된 청크 개수(없으면 null).
  const readCount = async ({ key }: { key: string }): Promise<number | null> => {
    const raw = await secureStore.getItemAsync(key);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  };

  // 기존 청크 전부 삭제(overwrite 시 stale 꼬리 방지 + removeItem).
  const clearChunks = async ({ key, count }: { key: string; count: number }): Promise<void> => {
    for (let i = 0; i < count; i += 1) {
      await secureStore.deleteItemAsync(chunkKey({ key, index: i }));
    }
  };

  const setItem = async (key: string, value: string): Promise<void> => {
    // 이전 값의 청크를 먼저 정리(작은 값으로 덮어쓸 때 stale 청크 제거).
    const prev = await readCount({ key });
    if (prev !== null) await clearChunks({ key, count: prev });

    const chunks = splitChunks({ value });
    for (let i = 0; i < chunks.length; i += 1) {
      await secureStore.setItemAsync(chunkKey({ key, index: i }), chunks[i]);
    }
    await secureStore.setItemAsync(key, String(chunks.length));
  };

  const readFromSecure = async ({
    key,
    count,
  }: {
    key: string;
    count: number;
  }): Promise<string | null> => {
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await secureStore.getItemAsync(chunkKey({ key, index: i }));
      if (part === null) return null; // 손상(청크 누락) → 재인증 유도(null).
      parts.push(part);
    }
    return parts.join('');
  };

  const getItem = async (key: string): Promise<string | null> => {
    const count = await readCount({ key });
    if (count !== null) return readFromSecure({ key, count });

    // SecureStore 미보유 → 레거시(AsyncStorage) 마이그레이션 1회.
    const legacy = await legacyStore.getItem(key);
    if (legacy === null) return null;
    await setItem(key, legacy);
    await legacyStore.removeItem(key); // 중복 잔존(평문) 제거(best-effort).
    return legacy;
  };

  const removeItem = async (key: string): Promise<void> => {
    const count = await readCount({ key });
    if (count !== null) await clearChunks({ key, count });
    await secureStore.deleteItemAsync(key);
    await legacyStore.removeItem(key); // 레거시 잔존도 함께 정리.
  };

  return { getItem, setItem, removeItem };
};
