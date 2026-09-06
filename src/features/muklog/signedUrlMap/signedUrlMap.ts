// src/features/muklog/signedUrlMap.ts
// 비공개 버킷(muklog-photos) 사진 경로들의 signed URL 배치 발급 공용 유틸.
//   useMuklogs·useMuklog·useLogPreviewUrls 에 문자 그대로 중복되던 로직을 흡수:
//   createSignedUrls로 1회 배치 발급(개별 N회 금지, 비용 가드레일 §8) → path→URL 맵.
//   best-effort: 실패/누락 path는 맵에서 빠져 소비처가 빈 슬롯/coverUri null 폴백(사진 때문에 목록을 막지 않음).
//   버킷·TTL 은 photoPath 단일 출처를 참조(값 드리프트 방지).
//
// 재사용 캐시(query-cache §3.6): 이 모듈이 storage_path→(URL, 만료) 저장소를 소유한다.
//   잔여 유효시간이 넉넉한 path는 발급하지 않고 이전 URL 문자열을 그대로 돌려준다 →
//   RN Image의 캐시 키(=URL)가 유지되어 이미 본 사진이 다시 내려받아지지 않는다(U58 ②).
//   판정·기록 규칙과 "무효화가 없는 이유"는 signedUrlCache.ts 주석 참조.
import { supabase } from '@/lib/supabase';

import { MUKLOG_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from '../photoPath';
import {
  createSignedUrlStore,
  partitionSignedUrlPaths,
  putSignedUrls,
} from '../signedUrlCache';

// 모듈 싱글턴 저장소 — 화면·훅을 가로질러 같은 사진에 같은 URL을 주기 위해 앱 수명 동안 유지한다.
//   상한(500건)과 만료 정리는 putSignedUrls가 담당하므로 무한히 자라지 않는다.
const signedUrlStore = createSignedUrlStore();

/**
 * 사진 storage_path 목록의 signed URL 을 1회 배치 발급해 path→URL 맵으로 만든다.
 * 캐시에 살아 있는 path는 발급하지 않고 이전 URL을 그대로 재사용한다(같은 사진 = 같은 URL 문자열).
 * @param paths storage_path 목록(빈 배열이면 조회 없이 빈 맵). 중복은 내부에서 1회로 합친다.
 * @returns storage_path → signed URL 맵. 미발급 path 는 키 없음(소비처 폴백).
 */
export const createSignedUrlMap = async ({
  paths,
}: {
  paths: string[];
}): Promise<Record<string, string>> => {
  if (paths.length === 0) return {};

  const now = Date.now();
  const { hits, misses } = partitionSignedUrlPaths({ store: signedUrlStore, paths, now });
  // 전부 캐시 히트면 네트워크 호출 0(비용 가드레일 §8 — 발급 호출이 가장 크게 줄어드는 지점).
  if (misses.length === 0) return { ...hits };

  const issued: Record<string, string> = {};
  try {
    const { data, error } = await supabase.storage
      .from(MUKLOG_PHOTOS_BUCKET)
      .createSignedUrls(misses, SIGNED_URL_TTL_SECONDS);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl) issued[item.path] = item.signedUrl;
      }
    }
  } catch {
    // best-effort: 발급 실패는 빈/부분 맵 → 소비처가 빈 슬롯 폴백(사진 때문에 목록을 막지 않는다).
  }

  // 실패/누락 path는 issued에 없으므로 캐시에도 기록되지 않는다 → 다음 호출에서 다시 시도된다.
  putSignedUrls({ store: signedUrlStore, urls: issued, now, ttlSeconds: SIGNED_URL_TTL_SECONDS });

  return { ...hits, ...issued };
};

/**
 * 서명 URL 재사용 캐시를 비운다(로그아웃 정리 + 테스트 격리 양쪽에서 쓴다).
 * 계정을 바꿔도 이전 사용자의 사진 URL이 남지 않게 한다(plan E1).
 */
export const resetSignedUrlCache = (): void => {
  signedUrlStore.clear();
};
