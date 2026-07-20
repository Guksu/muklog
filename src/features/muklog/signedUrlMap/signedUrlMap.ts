// src/features/muklog/signedUrlMap.ts
// 비공개 버킷(muklog-photos) 사진 경로들의 signed URL 배치 발급 공용 유틸.
//   useMuklogs·useMuklog·useLogPreviewUrls 에 문자 그대로 중복되던 로직을 흡수:
//   createSignedUrls로 1회 배치 발급(개별 N회 금지, 비용 가드레일 §8) → path→URL 맵.
//   best-effort: 실패/누락 path는 맵에서 빠져 소비처가 빈 슬롯/coverUri null 폴백(사진 때문에 목록을 막지 않음).
//   버킷·TTL 은 photoPath 단일 출처를 참조(값 드리프트 방지).
import { supabase } from '@/lib/supabase';

import { MUKLOG_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from '../photoPath';

/**
 * 사진 storage_path 목록의 signed URL 을 1회 배치 발급해 path→URL 맵으로 만든다.
 * @param paths storage_path 목록(빈 배열이면 조회 없이 빈 맵). 중복 제거는 호출부 책임(키 안정화가 필요한 경우).
 * @returns storage_path → signed URL 맵. 미발급 path 는 키 없음(소비처 폴백).
 */
export const createSignedUrlMap = async ({
  paths,
}: {
  paths: string[];
}): Promise<Record<string, string>> => {
  if (paths.length === 0) return {};
  const map: Record<string, string> = {};
  try {
    const { data, error } = await supabase.storage
      .from(MUKLOG_PHOTOS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return map;
    for (const item of data) {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    }
  } catch {
    // best-effort: 발급 실패는 빈/부분 맵 → 소비처가 빈 슬롯 폴백(사진 때문에 목록을 막지 않는다).
  }
  return map;
};
