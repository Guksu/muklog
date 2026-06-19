// src/features/room/useLogPreviewUrls.ts
// 로그 카드 썸네일 signed URL 배치 발급 (log_preview_photos).
//   list_my_rooms preview_paths(storage_path)는 비공개 버킷 키라 그대로는 못 그린다 →
//   createSignedUrls로 1회 배치 발급해 path→URL 맵을 만든다(개별 N회 금지, 비용 가드레일 §8).
//   best-effort: 실패/누락 path는 맵에서 빠져 해당 슬롯이 빈 슬롯으로 폴백(사진 때문에 목록 막지 않음).
//   경로 집합(key)이 바뀔 때만 재발급 — 폴링/주기 호출 없음.
import { useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

const MUKLOG_PHOTOS_BUCKET = 'muklog-photos'; // muklog-photos 스프린트 비공개 버킷(단일 출처).
const SIGNED_URL_TTL_SECONDS = 3600; // 1h — useMuklog와 동일 정책.

/**
 * 로그 미리보기 사진 경로들의 signed URL을 1회 배치 발급해 path→URL 맵을 제공한다.
 * @param paths 전체 로그의 preview_paths를 합친 storage_path 목록(중복/빈 허용 — 내부 정규화)
 * @returns urls: storage_path → signed URL 맵(미발급 path는 키 없음 → 소비처가 빈 슬롯 폴백)
 */
export const useLogPreviewUrls = ({ paths }: { paths: string[] }): { urls: Record<string, string> } => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const mountedRef = useRef(true);

  // 중복 제거 + 정렬 → 안정적 키. 같은 경로 집합이면 재발급하지 않는다(폴링 방지).
  const unique = Array.from(
    new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0)),
  ).sort();
  const key = unique.join('|');

  useEffect(
    function fetchPreviewSignedUrls() {
      mountedRef.current = true;
      if (unique.length === 0) {
        setUrls({});
        return function cleanup() {
          mountedRef.current = false;
        };
      }
      const run = async () => {
        const map: Record<string, string> = {};
        try {
          const { data, error } = await supabase.storage
            .from(MUKLOG_PHOTOS_BUCKET)
            .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
          if (!error && data) {
            for (const item of data) {
              if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
            }
          }
        } catch {
          // best-effort: 발급 실패는 해당 슬롯 제외(목록을 막지 않는다).
        }
        if (mountedRef.current) setUrls(map);
      };
      void run();
      return function cleanup() {
        mountedRef.current = false;
      };
    },
    // key(경로 집합) 변경 시에만 재발급. unique는 매 렌더 새 배열이라 의도적으로 deps에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return { urls };
};
