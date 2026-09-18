// src/features/muklog/signedUrlCache.spec.ts
// 서명 URL 재사용 캐시(순수) 명세 (query-cache plan §3.6 / T2, U5~U10).
//   왜: 재조회마다 새 토큰이 박힌 새 URL이 발급되면 RN Image의 캐시 키(=URL 문자열)가 매번 미스가 되어
//   이미 보고 있던 사진이 다시 내려받아진다(빈칸 갭·재페이드 = U58 ②). 같은 storage_path에는 같은 URL을 준다.
//   시각은 인자로 주입한다(fake timer 불필요 — 순수 함수 seam).
import {
  SIGNED_URL_CACHE_MAX_ENTRIES,
  SIGNED_URL_REUSE_MARGIN_MS,
  createSignedUrlStore,
  partitionSignedUrlPaths,
  putSignedUrls,
} from './signedUrlCache';

const NOW = 1_700_000_000_000;

describe('partitionSignedUrlPaths', () => {
  it('U5: 전부 hit이면 misses는 빈 배열이고 hits에 캐시된 URL이 담긴다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a', b: 'https://s/b' }, now: NOW, ttlSeconds: 3600 });

    const { hits, misses } = partitionSignedUrlPaths({ store, paths: ['a', 'b'], now: NOW });

    expect(hits).toEqual({ a: 'https://s/a', b: 'https://s/b' });
    expect(misses).toEqual([]);
  });

  it('U6: 빈 저장소면 전부 miss이고 hits는 빈 객체다', () => {
    const store = createSignedUrlStore();

    const { hits, misses } = partitionSignedUrlPaths({ store, paths: ['a', 'b'], now: NOW });

    expect(hits).toEqual({});
    expect(misses).toEqual(['a', 'b']);
  });

  it('U7(경계): 잔여 유효시간이 정확히 마진(10분)이면 재사용(hit)한다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW, ttlSeconds: 3600 });
    // 발급 후 (3600s - 10분)이 지난 시각 = 잔여 정확히 10분.
    const at = NOW + 3600 * 1000 - SIGNED_URL_REUSE_MARGIN_MS;

    expect(partitionSignedUrlPaths({ store, paths: ['a'], now: at }).misses).toEqual([]);
    expect(partitionSignedUrlPaths({ store, paths: ['a'], now: at }).hits).toEqual({ a: 'https://s/a' });
  });

  it('U7(경계): 잔여가 마진보다 1ms라도 짧으면 재발급 대상(miss)이다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW, ttlSeconds: 3600 });
    const at = NOW + 3600 * 1000 - SIGNED_URL_REUSE_MARGIN_MS + 1;

    expect(partitionSignedUrlPaths({ store, paths: ['a'], now: at })).toEqual({ hits: {}, misses: ['a'] });
  });

  it('U8(경계): 이미 만료된 항목(잔여 음수)은 miss다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW, ttlSeconds: 3600 });

    expect(partitionSignedUrlPaths({ store, paths: ['a'], now: NOW + 3600 * 1000 + 1 }).misses).toEqual(['a']);
  });

  it('부분 히트: 캐시된 것만 hits, 나머지만 misses로 가른다(AC2-2의 순수층)', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW, ttlSeconds: 3600 });

    expect(partitionSignedUrlPaths({ store, paths: ['a', 'b'], now: NOW })).toEqual({
      hits: { a: 'https://s/a' },
      misses: ['b'],
    });
  });

  it('중복 path는 misses에서 1회로 합친다(같은 사진을 두 번 발급하지 않는다)', () => {
    const store = createSignedUrlStore();

    expect(partitionSignedUrlPaths({ store, paths: ['b', 'b', 'a'], now: NOW }).misses).toEqual(['b', 'a']);
  });
});

describe('putSignedUrls', () => {
  it('U10: expiresAt = now + ttlSeconds*1000으로 기록한다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW, ttlSeconds: 3600 });

    expect(store.get('a')).toEqual({ url: 'https://s/a', expiresAt: NOW + 3600 * 1000 });
  });

  it('U9(경계): 상한을 넘으면 만료가 임박한 것부터 폐기해 크기를 상한 이하로 유지한다', () => {
    const store = createSignedUrlStore();
    // 오래된(=만료 임박) 항목 상한만큼 채운다 — ttl을 짧게 줘 expiresAt이 앞서게 한다.
    const old: Record<string, string> = {};
    for (let i = 0; i < SIGNED_URL_CACHE_MAX_ENTRIES; i += 1) old[`old-${i}`] = `https://s/old-${i}`;
    putSignedUrls({ store, urls: old, now: NOW, ttlSeconds: 1800 });

    putSignedUrls({ store, urls: { fresh: 'https://s/fresh' }, now: NOW, ttlSeconds: 3600 });

    expect(store.size).toBeLessThanOrEqual(SIGNED_URL_CACHE_MAX_ENTRIES);
    // 가장 늦게까지 유효한 신규 항목은 살아남는다.
    expect(store.get('fresh')?.url).toBe('https://s/fresh');
    // 만료가 가장 임박한 축(오래된 것)에서 폐기가 일어났다.
    expect(store.size).toBe(SIGNED_URL_CACHE_MAX_ENTRIES);
  });

  it('이미 만료된 항목은 기록 시점에 정리된다(무한 증가 방지)', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { stale: 'https://s/stale' }, now: NOW, ttlSeconds: 60 });

    putSignedUrls({ store, urls: { a: 'https://s/a' }, now: NOW + 61_000, ttlSeconds: 3600 });

    expect(store.has('stale')).toBe(false);
    expect(store.has('a')).toBe(true);
  });

  it('같은 path를 다시 발급하면 최신 URL·만료로 덮어쓴다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: { a: 'https://s/a1' }, now: NOW, ttlSeconds: 3600 });
    putSignedUrls({ store, urls: { a: 'https://s/a2' }, now: NOW + 1000, ttlSeconds: 3600 });

    expect(store.get('a')).toEqual({ url: 'https://s/a2', expiresAt: NOW + 1000 + 3600 * 1000 });
  });

  it('빈 발급 결과는 저장소를 바꾸지 않는다', () => {
    const store = createSignedUrlStore();
    putSignedUrls({ store, urls: {}, now: NOW, ttlSeconds: 3600 });

    expect(store.size).toBe(0);
  });
});
