// src/features/muklog/useCreateMuklog.ts
// 먹로그 생성 훅 (plan §5.3 / §5 T6, AC2·AC3·AC8).
//
// 생산자: 클라 직접 insert(RLS 하). created_by = auth.getUser()의 uid를 채워
//   from('muklogs').insert(row).select('id').single(). RLS `with check (created_by=auth.uid())`가
//   누락/위조를 거부(AC8). 트리거(enforce_muklog_fields)가 값 범위 최종 방어.
// 소비자: MuklogEntrySheet(저장 버튼) → 성공 시 onSaved → MuklogList.refresh()(AC2·AC12).
//
// 검증: normalizeMuklogInput으로 앱단 1차 차단(장소명 빈→insert 미호출, rating/미래일 차단).
//   에러는 mapMuklogError로 한국어 메시지(error 상태) + 원본 throw(시트가 입력 보존).
//   중복 저장은 loading 중 시트 버튼 비활성으로 방지(엣지 §9).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapMuklogError } from '../errors';
import { type CreateMuklogInput } from '../types';
import { uploadMuklogPhotos } from '../uploadMuklogPhotos';
import { normalizeMuklogInput, toMuklogRow } from '../validate';

export type CreateMuklogResult = { id: string };

/**
 * 새 먹로그 발송 트리거(push-send §3) — send-muklog-push Edge Function 에 best-effort 발송 요청.
 *   fire-and-forget: invoke 실패(네트워크/함수 에러)를 흡수해 createMuklog 결과/에러에 절대 영향 주지 않는다.
 *   인증은 invoke 가 Authorization(JWT)을 자동 첨부 → 함수가 callerId 검증(클라는 userId 미전송).
 *   토큰/수신자 게이팅은 서버(RPC)가 전담 — 클라는 roomId/muklogId만 넘긴다.
 * @param roomId 새 먹로그가 속한 로그(방) id
 * @param muklogId 방금 생성된 먹로그 id(data/딥링크용)
 */
const triggerMuklogPush = async ({
  roomId,
  muklogId,
}: {
  roomId: string;
  muklogId: string;
}): Promise<void> => {
  try {
    await supabase.functions.invoke('send-muklog-push', { body: { roomId, muklogId } });
  } catch (error) {
    // best-effort: 발송 실패는 저장 결과를 망치지 않는다(로그만).
    console.warn('[useCreateMuklog] 푸시 발송 트리거 실패(무시):', error);
  }
};

/**
 * 먹로그 생성 액션과 로딩/에러 상태를 제공하는 훅.
 * createMuklog({ input })가 입력을 검증·정규화하고 insert를 수행해 { id }를 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(시트가 입력을 보존).
 */
export const useCreateMuklog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사진 업로드 실패 시 방금 만든 muklog를 best-effort 삭제한다(부분성공 회피, 일관성 §6).
  //   muklogs_delete_own RLS(created_by=auth.uid())가 본인 행만 허용. FK ON DELETE CASCADE로
  //   이미 insert된 muklog_photos 행도 함께 정리(Storage 파일 정리는 uploadMuklogPhotos가 담당).
  //   정리 자체 실패는 무시한다(원본 사진 에러를 사용자에게 노출하는 게 우선).
  const rollbackMuklog = async ({ muklogId }: { muklogId: string }) => {
    try {
      await supabase.from('muklogs').delete().eq('id', muklogId);
    } catch {
      // best-effort: 롤백 실패는 무시(차기 정리 잡 위임).
    }
  };

  const createMuklog = async ({
    input,
  }: {
    input: CreateMuklogInput;
  }): Promise<CreateMuklogResult> => {
    setLoading(true);
    setError(null);
    try {
      // 앱단 1차 검증/정규화(장소명 필수·rating 1~5·미래일 차단) — 위반 시 토큰 throw.
      const normalized = normalizeMuklogInput({ input });

      // created_by는 RLS with check가 auth.uid()와 일치하길 강제 → 실제 인증 uid를 채운다.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error('NOT_AUTHENTICATED');

      const { data, error: insertError } = await supabase
        .from('muklogs')
        .insert(toMuklogRow({ input: normalized, userId }))
        .select('id')
        .single();
      if (insertError) throw insertError;

      const obj = (data ?? {}) as { id?: string };
      if (!obj.id) throw new Error('CREATE_MUKLOG_BAD_RESPONSE');
      const muklogId = obj.id;

      // 사진(0~5장) 연동 — muklog insert 성공 후 순차 업로드 + muklog_photos insert(plan §5 ④).
      //   사진 없으면 업로드 단계 스킵. 업로드 실패 시 "사진 없이 남는" 어중간한 상태를 피하려
      //   방금 만든 muklog를 best-effort 롤백 삭제(muklogs_delete_own RLS 사용, 일관성 §6) 후 throw.
      const photos = input.photos ?? [];
      if (photos.length > 0) {
        try {
          await uploadMuklogPhotos({ roomId: normalized.roomId, muklogId, photos });
        } catch (photoError) {
          await rollbackMuklog({ muklogId });
          throw photoError;
        }
      }

      // 발송 트리거(push-send §3) — 먹로그+사진 완료 직후 상대에게 푸시 발송 요청(send-muklog-push Edge Function).
      //   fire-and-forget(best-effort): 발송 실패는 흡수 — 저장은 이미 끝났으므로 createMuklog 결과/에러에 영향 0.
      //   본인 식별·멤버십·수신자 prefs 게이팅은 모두 서버(JWT callerId + RPC)가 판정(클라는 roomId/muklogId만 전달).
      //   create 경로 전용(편집은 발송 안 함) — useUpdateMuklog는 이 트리거를 호출하지 않는다.
      await triggerMuklogPush({ roomId: normalized.roomId, muklogId });

      return { id: muklogId };
    } catch (err) {
      setError(mapMuklogError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createMuklog, loading, error };
};
