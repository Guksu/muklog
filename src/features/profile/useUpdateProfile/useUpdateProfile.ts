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
//
// picker-recovery: 업로드 본체는 uploadAvatarFromUri 로 공용화(정상/복구 재사용). picker 호출 직전
//   AsyncStorage에 컨텍스트를 영속(파괴 시 복구용), 정상 resolve 시 제거(§설계1·4).
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

import { mapProfileError, ProfileErrorToken } from '../errors';
import { validateNickname } from '../nickname';
import { clearPendingPick, PendingPickKind, savePendingPick } from '../pendingPick';
import { uploadAvatarFromUri } from '../uploadAvatarFromUri';

/**
 * 닉네임 저장 / 아바타 업로드 액션과 진행·에러 상태를 제공하는 훅.
 * @param userId 인증된(익명) 사용자 id (= auth.uid())
 * @returns saveNickname, changeAvatar 액션과 savingNickname/uploadingAvatar/error 상태
 */
export const useUpdateProfile = ({ userId }: { userId: string }) => {
  const [savingNickname, setSavingNickname] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // 2. picker 직전 컨텍스트 영속(Android 파괴 시 getPendingResultAsync 로 복구하기 위함, §설계1).
    await savePendingPick({ context: { kind: PendingPickKind.Avatar, userId } });

    // 3. 피커(이미지 한정). 취소면 조용히 종료(에러 아님, changed:false).
    //   legacy:true — Android 시스템 Photo Picker가 일부 기기에서 선택 결과를 안 돌려주는(promise hang)
    //   문제 회피. legacy picker(권한 기반)로 강제 → 결과 정상 수신. iOS는 무시(영향 0).
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      legacy: true,
    });
    // 정상 resolve(파괴 안 됨) → 컨텍스트 제거(복구 중복 방지). 파괴 시 이 줄 미실행 → 복구가 처리.
    await clearPendingPick();
    if (picked.canceled || !picked.assets?.[0]) return { changed: false };
    const sourceUri = picked.assets[0].uri;

    setUploadingAvatar(true);
    try {
      await uploadAvatarFromUri({ uri: sourceUri, userId });
      return { changed: true };
    } catch {
      setError(mapProfileError({ error: ProfileErrorToken.AvatarUploadFailed }));
      throw new Error(ProfileErrorToken.AvatarUploadFailed);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return { saveNickname, changeAvatar, savingNickname, uploadingAvatar, error };
};
