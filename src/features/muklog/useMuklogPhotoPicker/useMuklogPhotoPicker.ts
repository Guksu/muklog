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

import { MuklogErrorToken } from '../errors';
import { type PickedPhoto } from '../types';

export const MUKLOG_PHOTO_MAX = 5; // 먹로그당 최대 사진 수(plan 0~5)

/**
 * 먹로그 사진 선택 상태와 추가/삭제/초기화 액션을 제공하는 훅.
 * @returns photos(선택된 로컬 사진), addPhotos(권한+picker), removePhoto, reset
 */
export const useMuklogPhotoPicker = () => {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  // 권한 요청 → 갤러리 다중선택 → 선택 자산을 PickedPhoto[]로 반환(상태 미변경, 순수 선택).
  //   편집 모드(MuklogEntrySheet)는 자체 editorPhotos에 append하려 반환값만 쓴다(작성 상태와 분리).
  //   remaining = 남은 슬롯 수(편집: 5 - 기존 슬롯). 취소/0장이면 [] 반환(에러 아님).
  const pickPhotoAssets = async ({
    remaining = MUKLOG_PHOTO_MAX,
  }: { remaining?: number } = {}): Promise<PickedPhoto[]> => {
    // 1. 갤러리 권한. 거부면 picker 미실행 + 공통 권한 토큰 throw(소비처가 메시지 매핑).
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error(MuklogErrorToken.PermissionDenied);

    // 2. 다중선택(이미지 한정, 남은 슬롯까지). 취소면 조용히 종료(빈 배열).
    const limit = Math.max(0, remaining);
    if (limit === 0) return [];
    // legacy:true — Android 시스템 Photo Picker가 일부 기기에서 선택 결과를 안 돌려주는(promise hang)
    //   문제 회피. legacy picker(권한 기반)로 강제 → 결과 정상 수신. iOS는 무시(영향 0).
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 1,
      legacy: true,
    });
    if (picked.canceled || !picked.assets?.length) return [];

    // 3. 선택 자산 → PickedPhoto. 남은 슬롯 수까지만 채택(초과 무시, 엣지 §6).
    return picked.assets.map((asset) => ({ uri: asset.uri })).slice(0, limit);
  };

  const addPhotos = async (): Promise<void> => {
    const newPhotos = await pickPhotoAssets({ remaining: MUKLOG_PHOTO_MAX - photos.length });
    if (newPhotos.length === 0) return;
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, MUKLOG_PHOTO_MAX));
  };

  const removePhoto = ({ index }: { index: number }): void => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const reset = (): void => {
    setPhotos([]);
  };

  return { photos, addPhotos, pickPhotoAssets, removePhoto, reset };
};
