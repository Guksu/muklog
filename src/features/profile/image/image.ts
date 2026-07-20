// src/features/profile/image.ts
// 아바타 이미지 처리 유틸 (plan §3.4, T4 / P7).
//
// 생산자: 갤러리에서 고른 원본 uri를 512×512 정사각 + JPEG q0.7로 크롭/다운스케일/압축.
// 소비자: useUpdateProfile.changeAvatar — 업로드 전 반드시 이 처리본만 올린다(원본 직업로드 금지, 비용 가드레일 §8).
// 비정사각 원본은 중앙 정사각 크롭 후 512로 리사이즈한다(웹 object-fit: cover 등가 — 찌그러짐 없음).
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const AVATAR_SIZE = 512; // 512×512 정사각 (비용 가드레일)
export const AVATAR_COMPRESS = 0.7; // JPEG q0.7

export type ProcessedImage = { uri: string; width: number; height: number };

/**
 * 아바타 원본 이미지를 중앙 정사각 크롭 후 512×512 JPEG(q0.7)로 다운스케일/압축한다.
 * 비정사각 원본도 왜곡 없이 채운다(object-fit: cover 등가).
 * @param uri 갤러리에서 선택한 원본 이미지 로컬 uri
 * @returns 처리된 로컬 jpeg의 uri/width/height
 */
export const processAvatarImage = async ({ uri }: { uri: string }): Promise<ProcessedImage> => {
  // 원본 치수 획득(추가 의존성 없이 no-op manipulate) → 짧은 변 기준 중앙 정사각 영역 계산.
  const source = await manipulateAsync(uri, []);
  const side = Math.min(source.width, source.height);
  const originX = Math.round((source.width - side) / 2);
  const originY = Math.round((source.height - side) / 2);

  const result = await manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: side, height: side } },
      { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
    ],
    { compress: AVATAR_COMPRESS, format: SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
};
