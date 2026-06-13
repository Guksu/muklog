// src/features/muklog/useMuklogPhotoPicker.ts
// 먹로그 사진 picker 상태 훅 (plan §5 ⑤, §6 / ui-spec §3.1·§3.2).
//
// 생산자: 갤러리 권한 요청 → 다중선택(selectionLimit 5) → 선택 자산 uri를 photos(PickedPhoto[])에 추가.
//   소비자: MuklogEntrySheet가 photos/addPhotos/removePhoto/reset를 PhotoPickerGrid·createMuklog에 연결.
//   실제 업로드/처리는 useCreateMuklog(uploadMuklogPhotos)가 담당 — 이 훅은 로컬 선택 상태만 관리.
//
// 한계(plan §6): 총합이 5장(MAX)을 넘으면 앞에서 채워 5장까지만 채택(초과 무시). 권한 거부 시 picker 미실행+토큰 throw.
//   취소는 조용히 종료(에러 아님). 네이티브 실제 선택/권한 UI는 디바이스 스모크로 검증.
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { MuklogErrorToken } from './errors';
import { type PickedPhoto } from './types';

export const MUKLOG_PHOTO_MAX = 5; // 먹로그당 최대 사진 수(plan 0~5)

/**
 * 먹로그 사진 선택 상태와 추가/삭제/초기화 액션을 제공하는 훅.
 * @returns photos(선택된 로컬 사진), addPhotos(권한+picker), removePhoto, reset
 */
export const useMuklogPhotoPicker = () => {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const addPhotos = async (): Promise<void> => {
    // 1. 갤러리 권한. 거부면 picker 미실행 + 공통 권한 토큰 throw(소비처가 메시지 매핑).
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error(MuklogErrorToken.PermissionDenied);

    // 2. 다중선택(이미지 한정, 최대 5). 취소면 조용히 종료(에러 아님).
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MUKLOG_PHOTO_MAX,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.length) return;

    // 3. 선택 자산 → PickedPhoto. 기존 + 신규 합쳐 앞에서 5장까지만 채택(초과 무시, 엣지 §6).
    const newPhotos: PickedPhoto[] = picked.assets.map((asset) => ({ uri: asset.uri }));
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, MUKLOG_PHOTO_MAX));
  };

  const removePhoto = ({ index }: { index: number }): void => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = (): void => {
    setPhotos([]);
  };

  return { photos, addPhotos, removePhoto, reset };
};
