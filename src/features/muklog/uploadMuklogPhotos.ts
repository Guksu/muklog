// src/features/muklog/uploadMuklogPhotos.ts
// 먹로그 사진 순차 업로드 (plan §3.5 / §5 ③, 경계면 §7).
//
// 생산자(쓰기): muklogId·roomId 확정 후 N장을 선택 순서대로 순차 업로드한다.
//   각 장: processMuklogPhoto(장변 1280·JPEG q0.7) → fetch().arrayBuffer() → storage.upload(path, jpeg, upsert:false)
//          → muklog_photos.insert({ muklog_id, storage_path, order_index: i }).
//   경로 첫 세그먼트=roomId(storage 정책 멤버십), order_index=선택 순서(0..N-1).
// 소비자: useCreateMuklog — 반환 uploadedPaths를 받고, throw 시 muklog row를 정리(부분성공 회피).
//
// 일관성(plan §6): 중간 실패 시 throw하기 전에 이미 올린 파일/행을 best-effort 정리(orphan 방지).
//   같은 세션에서만 가능 — 앱 종료/네트워크 끊김으로 남는 orphan은 차기 정리 잡 위임(plan §6, OUT).
import { supabase } from '@/lib/supabase';

import { processMuklogPhoto } from './photoImage';
import { type PickedPhoto } from './types';
import { MUKLOG_PHOTOS_BUCKET, buildMuklogPhotoPath, createPhotoFileId } from './photoPath';

export type UploadMuklogPhotosResult = { uploadedPaths: string[] };

/**
 * 업로드된 파일/행을 best-effort 정리한다(orphan 방지). 실패는 무시(치명적 아님).
 * @param paths 정리할 storage 키 목록(이미 업로드 성공한 것)
 */
const cleanupUploadedPhotos = async ({ paths }: { paths: string[] }): Promise<void> => {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(MUKLOG_PHOTOS_BUCKET).remove(paths);
  } catch {
    // best-effort: 정리 실패는 무시(차기 정리 잡 위임).
  }
  try {
    await supabase.from('muklog_photos').delete().in('storage_path', paths);
  } catch {
    // best-effort: insert된 행이 없거나 정리 실패해도 무시.
  }
};

/**
 * N장의 사진을 선택 순서대로 순차 업로드하고 muklog_photos에 기록한다.
 * 중간 실패 시 이미 올린 파일/행을 best-effort 정리한 뒤 원본 에러를 throw한다.
 * @param roomId 상위 로그(방) id — 경로 첫 세그먼트(storage 멤버십 판정)
 * @param muklogId 방금 생성된 먹로그 id — 경로 두 번째 세그먼트 + FK
 * @param photos 선택된 로컬 사진(선택 순서 = order_index). 빈 배열이면 즉시 반환
 * @returns 업로드 성공한 storage 키 목록
 */
export const uploadMuklogPhotos = async ({
  roomId,
  muklogId,
  photos,
}: {
  roomId: string;
  muklogId: string;
  photos: PickedPhoto[];
}): Promise<UploadMuklogPhotosResult> => {
  const uploadedPaths: string[] = [];

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];

      // 1. 처리본(장변 1280·JPEG q0.7)만 업로드(원본 직업로드 0, 비용 가드레일 §8).
      const processed = await processMuklogPhoto({ uri: photo.uri });

      // 2. 처리본을 ArrayBuffer로 읽기(supabase RN 업로드 권장 방식).
      const fileBody = await fetch(processed.uri).then((res) => res.arrayBuffer());

      // 3. 업로드(경로 첫 세그먼트=roomId, jpeg, 덮어쓰기 금지).
      const path = buildMuklogPhotoPath({ roomId, muklogId, fileId: createPhotoFileId() });
      const { error: uploadError } = await supabase.storage
        .from(MUKLOG_PHOTOS_BUCKET)
        .upload(path, fileBody, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);

      // 4. muklog_photos 행 기록(order_index=선택 순서). RLS가 내 방·내 먹로그만 허용.
      const { error: insertError } = await supabase
        .from('muklog_photos')
        .insert({ muklog_id: muklogId, storage_path: path, order_index: index });
      if (insertError) throw insertError;
    }

    return { uploadedPaths };
  } catch (err) {
    await cleanupUploadedPhotos({ paths: uploadedPaths });
    throw err;
  }
};
