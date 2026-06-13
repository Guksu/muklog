// src/features/muklog/useUpdateMuklog.ts
// 먹로그 수정 훅 (plan §3.3·§3.4 / §7 작업③, 경계면 §8).
//
// 생산자: 클라 직접 update(RLS 하). normalizeMuklogInput(앱 1차) → muklogs.update(필드만).eq('id').select('id').single()
//   → planPhotoReconcile → "삭제(행 delete → Storage remove) → 신규 업로드(uploadMuklogPhotos) → reindex(update)" 순.
//   created_by/room_id는 update payload에 넣지 않는다(불변 — RLS with check가 위변조를 막지만 payload 자체를 미전송).
// 소비자: MuklogDetailRoute onSubmit → MuklogEntrySheet 편집 저장 → 성공 시 시트 close + useMuklog.refresh.
//
// 일관성(plan §6, create와 다름): **롤백 없음**(기존 먹로그 보존 우선). 필드 update를 먼저 하고 reconcile를 나중에 해
//   필드 update 실패(검증/RLS 0행)는 사진을 건드리기 전 빠르게 실패시킨다. reconcile 단계는 best-effort 경계 —
//   신규 업로드 실패 시 uploadMuklogPhotos가 그 세션 파일을 정리하고 throw, 이미 저장된 필드/기존 사진은 보존한다.
//   reindex 실패는 "순서만 어긋남"(손실 없음) — 다음 진입 시 order_index 기준 재정렬로 자연 복구.
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapMuklogError } from './errors';
import { MUKLOG_PHOTOS_BUCKET } from './photoPath';
import { planPhotoReconcile } from './reconcileMuklogPhotos';
import { type ExistingPhoto, type UpdateMuklogInput } from './types';
import { uploadMuklogPhotos } from './uploadMuklogPhotos';
import { normalizeMuklogInput } from './validate';

export type UpdateMuklogResult = { id: string };

/**
 * planPhotoReconcile 계획을 "삭제 → 신규 업로드 → reindex" 순으로 실행한다(plan §3.4 실행 순서).
 * 삭제: muklog_photos 행 delete(in storage_path) → Storage remove. (행 먼저 지워 reindex 충돌·잔여행 회피.)
 * 신규: 연속 그룹이면 한 번에, 흩어진 order면 각각 startOrderIndex로 업로드.
 * reindex: 유지 existing의 order_index update(muklog_photos_update_member RLS).
 * @param plan planPhotoReconcile 결과
 * @param roomId 경로/RLS용 방 id
 * @param muklogId 대상 먹로그 id
 */
const executePhotoReconcile = async ({
  plan,
  roomId,
  muklogId,
}: {
  plan: ReturnType<typeof planPhotoReconcile>;
  roomId: string;
  muklogId: string;
}): Promise<void> => {
  // 1. 삭제 — 행 delete 먼저(reindex 시 잔여행/충돌 회피), 이후 Storage 파일 remove(best-effort).
  if (plan.toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('muklog_photos')
      .delete()
      .in('storage_path', plan.toDelete);
    if (deleteError) throw deleteError;
    try {
      await supabase.storage.from(MUKLOG_PHOTOS_BUCKET).remove(plan.toDelete);
    } catch {
      // best-effort: Storage 파일 잔여(orphan)는 허용 — 행은 이미 지워졌다(차기 정리 잡).
    }
  }

  // 2. 신규 업로드 — 각 신규를 자신의 최종 order_index로 insert(startOrderIndex로 1장씩, 흩어진 order 대응).
  for (const add of plan.toAdd) {
    await uploadMuklogPhotos({
      roomId,
      muklogId,
      photos: [{ uri: add.uri }],
      startOrderIndex: add.orderIndex,
    });
  }

  // 3. reindex — 유지 existing의 order_index 갱신(muklog_photos_update_member RLS). 실패는 throw해 상위가 노출.
  for (const re of plan.toReindex) {
    const { error: reindexError } = await supabase
      .from('muklog_photos')
      .update({ order_index: re.orderIndex })
      .eq('storage_path', re.storagePath);
    if (reindexError) throw reindexError;
  }
};

/**
 * 먹로그 수정 액션과 로딩/에러 상태를 제공하는 훅.
 * updateMuklog({ input, initialPhotos })가 필드를 검증·update하고 사진을 reconcile한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(시트가 입력을 보존). 롤백 없음(기존 보존 우선).
 */
export const useUpdateMuklog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMuklog = async ({
    input,
    initialPhotos,
  }: {
    input: UpdateMuklogInput;
    initialPhotos: ExistingPhoto[];
  }): Promise<UpdateMuklogResult> => {
    setLoading(true);
    setError(null);
    try {
      // 앱단 1차 검증/정규화(장소명 필수·rating 1~5·미래일 차단). photos는 reconcile가 따로 처리.
      const normalized = normalizeMuklogInput({
        input: {
          roomId: input.roomId,
          placeName: input.placeName,
          category: input.category,
          area: input.area,
          rating: input.rating,
          memo: input.memo,
          visitedAt: input.visitedAt,
        },
      });

      // 필드 update — created_by/room_id 미포함(불변, 위변조 차단). 0행/에러면 사진 전 빠른 실패.
      const { data, error: updateError } = await supabase
        .from('muklogs')
        .update({
          place_name: normalized.placeName,
          category: normalized.category,
          area: normalized.area,
          rating: normalized.rating,
          memo: normalized.memo,
          visited_at: normalized.visitedAt,
        })
        .eq('id', input.muklogId)
        .select('id')
        .single();
      if (updateError) throw updateError;
      const obj = (data ?? {}) as { id?: string };
      if (!obj.id) throw new Error('UPDATE_MUKLOG_NOT_FOUND'); // 0행 = RLS 거부/없음.

      // 사진 reconciliation — storage_path 기준(signed URL 만료 무관) 삭제→업로드→reindex.
      const plan = planPhotoReconcile({ initial: initialPhotos, next: input.photos });
      await executePhotoReconcile({ plan, roomId: input.roomId, muklogId: input.muklogId });

      return { id: obj.id };
    } catch (err) {
      setError(mapMuklogError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { updateMuklog, loading, error };
};
