// src/features/muklog/signedUrlCache.ts
// 서명 URL 재사용 캐시(순수 층) — query-cache plan §3.6.
//
// 문제: createSignedUrls는 호출마다 새 토큰이 박힌 새 URL 문자열을 준다. TTL은 1시간인데도 재조회할 때마다
//   URL이 바뀌면 RN Image의 캐시 키(= URL 문자열)가 매번 미스가 되어 "이미 보고 있던 사진"이 다시 내려받아진다
//   → 카드가 잠깐 빈칸이 되거나(빈칸 갭) 페이드가 처음부터 다시 재생된다(UX 백로그 U58 ②).
// 해법: storage_path → (발급 URL, 만료 시각)를 들고 있다가, 잔여 유효시간이 넉넉하면 같은 URL 문자열을 준다.
//
// ⚠️ 무효화 코드가 없는 이유(다음 사람이 여기서 멈추지 않도록):
//   키인 storage_path는 사실상 불변 식별자다. 업로드 경로가 `{roomId}/{muklogId}/{시각-난수}.jpg`(photoPath)로
//   업로드마다 새로 만들어지고, uploadMuklogPhotos는 upsert:false라 기존 경로를 덮어쓰지 않는다.
//   편집의 사진 교체도 "옛 path 삭제 + 새 path 업로드"이고 reindex는 order_index만 바꾼다(reconcileMuklogPhotos).
//   즉 사진이 바뀌면 path 자체가 바뀌어 캐시가 자동으로 미스가 된다 → 뮤테이션 시 무효화할 대상이 없다.
//
// 시각(now)은 인자로 주입한다 — 순수 함수라 fake timer 없이 경계값을 테스트한다.

/** 캐시 1건 — 발급된 URL과 만료 시각(ms epoch). */
export type SignedUrlEntry = { url: string; expiresAt: number };

/**
 * 재사용 안전 여유(ms). 잔여 유효시간이 이보다 짧으면 재발급한다.
 * 화면에 오래 머문 뒤 스크롤로 이미지가 뒤늦게 로드돼도 URL이 살아 있게 하는 마진 —
 * TTL 3600초 기준 한 URL은 최대 50분 재사용된다.
 */
export const SIGNED_URL_REUSE_MARGIN_MS = 10 * 60 * 1000;

/** 저장소 상한(건). 먹로그당 사진 최대 5장이므로 상세 100건 분량. 초과 시 만료 임박 순으로 폐기. */
export const SIGNED_URL_CACHE_MAX_ENTRIES = 500;

/**
 * 서명 URL 저장소를 만든다(모듈 싱글턴은 signedUrlMap이 소유, 테스트는 자기 저장소를 만든다).
 * @returns 빈 저장소(storage_path → SignedUrlEntry)
 */
export const createSignedUrlStore = (): Map<string, SignedUrlEntry> => new Map();

/**
 * 요청 경로를 재사용 가능한 hit과 재발급이 필요한 miss로 가른다.
 * @param store 서명 URL 저장소
 * @param paths 요청 storage_path 목록(중복 허용 — misses에서 1회로 합친다)
 * @param now 현재 시각(ms epoch)
 * @returns hits(path→캐시된 URL)와 misses(재발급할 path, 첫 등장 순서 유지)
 */
export const partitionSignedUrlPaths = ({
  store,
  paths,
  now,
}: {
  store: Map<string, SignedUrlEntry>;
  paths: string[];
  now: number;
}): { hits: Record<string, string>; misses: string[] } => {
  const hits: Record<string, string> = {};
  const misses: string[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    const entry = store.get(path);
    // 잔여가 마진 이상이면 재사용(경계 = 정확히 마진이면 재사용).
    if (entry && entry.expiresAt - now >= SIGNED_URL_REUSE_MARGIN_MS) {
      hits[path] = entry.url;
      continue;
    }
    misses.push(path);
  }

  return { hits, misses };
};

/**
 * 새로 발급된 URL을 저장소에 기록한다(만료분 정리 + 상한 초과 시 만료 임박 순 폐기).
 * @param store 서명 URL 저장소
 * @param urls 방금 발급된 path→URL 맵(실패/누락 path는 애초에 들어오지 않는다 — 다음 호출에서 재시도)
 * @param now 발급 시각(ms epoch)
 * @param ttlSeconds 발급에 사용한 TTL(초)
 */
export const putSignedUrls = ({
  store,
  urls,
  now,
  ttlSeconds,
}: {
  store: Map<string, SignedUrlEntry>;
  urls: Record<string, string>;
  now: number;
  ttlSeconds: number;
}): void => {
  const entries = Object.entries(urls);
  if (entries.length === 0) return;

  const expiresAt = now + ttlSeconds * 1000;
  for (const [path, url] of entries) store.set(path, { url, expiresAt });

  // 만료된 항목 정리(무한 증가 방지).
  for (const [path, entry] of store) {
    if (entry.expiresAt <= now) store.delete(path);
  }

  if (store.size <= SIGNED_URL_CACHE_MAX_ENTRIES) return;

  // 상한 초과분은 만료가 가장 임박한 것부터 폐기한다(가장 오래 쓸 수 있는 URL을 남긴다).
  const byExpiry = [...store.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const overflow = store.size - SIGNED_URL_CACHE_MAX_ENTRIES;
  for (let i = 0; i < overflow; i += 1) store.delete(byExpiry[i][0]);
};
