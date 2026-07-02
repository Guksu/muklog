// src/features/muklog/photoImage.ts
// 먹로그 사진 처리 유틸 (plan §3.4 / §5 ② / §8). 비용 가드레일: 장변 1280 + JPEG q0.7.
//
// 생산자: 갤러리에서 고른 원본 uri를 장변 1280px·JPEG q0.7로 다운스케일/압축(비율 보존).
// 소비자: uploadMuklogPhotos — 업로드 전 반드시 이 처리본만 올린다(원본 직업로드 금지, 비용 가드레일 §8).
// ⚠️ 아바타(image.ts)와 달리 정사각 강제 X — 장변(width)만 1280으로 제한해 RN manipulator가 비율 유지.
//    HEIC(iOS 기본) 원본도 JPEG로 변환 출력 → contentType 'image/jpeg' 정합(엣지 §6).
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export const PHOTO_MAX_EDGE = 1280; // 장변 1280px (비용 가드레일 §8)
export const PHOTO_COMPRESS = 0.7; // JPEG q0.7

export type ProcessedPhoto = { uri: string };

/**
 * 먹로그 사진 원본을 장변 1280px·JPEG(q0.7)로 리사이즈/압축한다(비율 보존, HEIC→JPEG).
 * @param uri 갤러리에서 선택한 원본 이미지 로컬 uri
 * @returns 처리된 로컬 jpeg의 uri
 */
export const processMuklogPhoto = async ({ uri }: { uri: string }): Promise<ProcessedPhoto> => {
  // width만 지정하면 manipulator가 비율 유지로 height를 자동 계산(장변 제한 효과).
  const result = await manipulateAsync(uri, [{ resize: { width: PHOTO_MAX_EDGE } }], {
    compress: PHOTO_COMPRESS,
    format: SaveFormat.JPEG,
  });
  return { uri: result.uri };
};
