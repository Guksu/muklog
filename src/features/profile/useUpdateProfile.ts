// src/features/profile/useUpdateProfile.ts
// 프로필 수정 훅 — 닉네임 저장 + 아바타 업로드 (plan §3.3, T6·T7 / P2·P3·P4·P5·P7·P10).
//
// 생산자(쓰기):
//   - profiles.update({ nickname }).eq('id', userId)          (own-only RLS, P2)
//   - storage.avatars.upload('{userId}/{uuid}.jpg', jpeg)     (소유자 정책, P3)
//   - profiles.update({ avatar_url: 공개URL }).eq('id', userId) (P4)
// 소비자: ProfileScreen — saveNickname/changeAvatar 호출 후 useProfile.refresh()로 즉시 반영.
//
// 비용 가드레일: 업로드 전 processAvatarImage(512·JPEG·0.7) 처리본만 업로드(원본 직업로드 0, P7).
//   교체 성공 시 이전 파일 best-effort 삭제(스토리지 누적 방지, P10). 실패는 무시.
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

import {
  AVATARS_BUCKET,
  buildAvatarPath,
  createAvatarFileId,
  parseAvatarPath,
} from './avatarPath';
import { mapProfileError, ProfileErrorToken } from './errors';
import { processAvatarImage } from './image';
import { validateNickname } from './nickname';

/**
 * 닉네임 저장 / 아바타 업로드 액션과 진행·에러 상태를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id (= auth.uid())
 * @returns saveNickname, changeAvatar 액션과 savingNickname/uploadingAvatar/error 상태
 */
export const useUpdateProfile = ({ userId }: { userId: string }) => {
  const [savingNickname, setSavingNickname] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이전 아바타 파일 best-effort 삭제(실패 무시 — 스토리지 누적 방지 가드레일).
  const removeAvatarFile = async ({ path }: { path: string }) => {
    try {
      await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    } catch {
      // best-effort: 정리 실패는 치명적이지 않으므로 무시한다.
    }
  };

  const saveNickname = async ({ nickname }: { nickname: string }) => {
    setError(null);

    // 검증 실패 → update 미호출 + 토큰 메시지(2차 방어, 화면 버튼은 1차 차단).
    const validation = validateNickname({ raw: nickname });
    if (!validation.ok) {
      const token =
        validation.reason === 'empty'
          ? ProfileErrorToken.NicknameEmpty
          : ProfileErrorToken.NicknameTooLong;
      setError(mapProfileError({ error: token }));
      throw new Error(token);
    }

    setSavingNickname(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ nickname: validation.value })
        .eq('id', userId);
      if (updateError) throw updateError;
    } catch (err) {
      setError(mapProfileError({ error: err }));
      throw err;
    } finally {
      setSavingNickname(false);
    }
  };

  // 반환: { changed }로 실변경 여부를 소비처(ProfileScreen 토스트)에 알린다.
  //   취소=changed:false(토스트 없음), 업로드 성공=changed:true, 실패=throw(기존 에러 유지).
  const changeAvatar = async (): Promise<{ changed: boolean }> => {
    setError(null);

    // 1. 갤러리 권한.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(mapProfileError({ error: ProfileErrorToken.PermissionDenied }));
      throw new Error(ProfileErrorToken.PermissionDenied);
    }

    // 2. 피커(이미지 한정). 취소면 조용히 종료(에러 아님, changed:false).
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) return { changed: false };
    const sourceUri = picked.assets[0].uri;

    setUploadingAvatar(true);
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

      // 3. 처리(512·JPEG·0.7) — 원본이 아닌 처리본만 업로드(P7).
      const processed = await processAvatarImage({ uri: sourceUri });

      // 4. 처리본을 ArrayBuffer로 읽기(supabase RN 업로드 권장 방식).
      const fileBody = await fetch(processed.uri).then((res) => res.arrayBuffer());

      // 5. 업로드(경로 첫 세그먼트=uid, jpeg, 덮어쓰기 금지).
      newPath = buildAvatarPath({ userId, fileId: createAvatarFileId() });
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(newPath, fileBody, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      // 6. 공개 URL → avatar_url 갱신(공개 URL 문자열 저장, P4).
      const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(newPath);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userId);
      if (updateError) throw updateError;

      // 7. 성공 시 이전 파일 정리(best-effort, P10).
      if (oldPath) await removeAvatarFile({ path: oldPath });
      return { changed: true };
    } catch {
      // 업로드/URL 갱신 실패 → 업로드된 새 파일 정리(orphan 방지) + 에러.
      if (newPath) await removeAvatarFile({ path: newPath });
      setError(mapProfileError({ error: ProfileErrorToken.AvatarUploadFailed }));
      throw new Error(ProfileErrorToken.AvatarUploadFailed);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return { saveNickname, changeAvatar, savingNickname, uploadingAvatar, error };
};
