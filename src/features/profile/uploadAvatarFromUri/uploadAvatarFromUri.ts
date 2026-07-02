// src/features/profile/uploadAvatarFromUri.ts
// 아바타 업로드 공용 함수 (picker-recovery §설계4) — changeAvatar 의 업로드 부분을 추출해
//   정상 경로(useUpdateProfile.changeAvatar)와 복구 경로(useRecoverPendingPick) 양쪽에서 재사용.
//
// 플로우: processAvatarImage(512·JPEG·0.7) → fetch arrayBuffer → storage.upload(uid/uuid.jpg)
//   → profiles.update({ avatar_url }) → 이전 파일 best-effort 정리(P10).
//   실패 시 업로드된 새 파일 정리(orphan 방지) 후 AvatarUploadFailed throw.
import { supabase } from '@/lib/supabase';

import {
  AVATARS_BUCKET,
  buildAvatarPath,
  createAvatarFileId,
  parseAvatarPath,
} from '../avatarPath';
import { ProfileErrorToken } from '../errors';
import { processAvatarImage } from '../image';

// 이전/실패 파일 best-effort 삭제(실패 무시 — 스토리지 누적 방지 가드레일).
const removeAvatarFile = async ({ path }: { path: string }): Promise<void> => {
  try {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  } catch {
    // best-effort: 정리 실패는 치명적이지 않으므로 무시한다.
  }
};

/**
 * 로컬 이미지 uri 를 처리·업로드하고 profiles.avatar_url 을 갱신한다.
 * @param uri 갤러리에서 고른(또는 복구된) 원본 이미지 로컬 uri
 * @param userId 소유자 uid(= auth.uid())
 * @returns 갱신된 공개 avatar_url
 * @throws AvatarUploadFailed 업로드/URL 갱신 실패(새 파일 정리 후)
 */
export const uploadAvatarFromUri = async ({
  uri,
  userId,
}: {
  uri: string;
  userId: string;
}): Promise<{ avatarUrl: string }> => {
  let newPath: string | null = null;
  try {
    // 정리용 이전 path(직전 avatar_url에서 역파싱). 0행/null이면 정리 스킵.
    const { data: current } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();
    const oldPath = parseAvatarPath({
      publicUrl: (current as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    });

    // 처리(512·JPEG·0.7) — 원본이 아닌 처리본만 업로드(P7).
    const processed = await processAvatarImage({ uri });

    // 처리본을 ArrayBuffer로 읽기(supabase RN 업로드 권장 방식).
    const fileBody = await fetch(processed.uri).then((res) => res.arrayBuffer());

    // 업로드(경로 첫 세그먼트=uid, jpeg, 덮어쓰기 금지).
    newPath = buildAvatarPath({ userId, fileId: createAvatarFileId() });
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(newPath, fileBody, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;

    // 공개 URL → avatar_url 갱신(공개 URL 문자열 저장, P4).
    const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(newPath);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', userId);
    if (updateError) throw updateError;

    // 성공 시 이전 파일 정리(best-effort, P10).
    if (oldPath) await removeAvatarFile({ path: oldPath });
    return { avatarUrl: urlData.publicUrl };
  } catch (err) {
    // 업로드/URL 갱신 실패 → 업로드된 새 파일 정리(orphan 방지) + 토큰 에러.
    if (newPath) await removeAvatarFile({ path: newPath });
    if (err instanceof Error && err.message === ProfileErrorToken.AvatarUploadFailed) throw err;
    throw new Error(ProfileErrorToken.AvatarUploadFailed);
  }
};
