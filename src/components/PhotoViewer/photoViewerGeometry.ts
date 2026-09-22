export type PhotoSize = { width: number; height: number };
export type PhotoPoint = { x: number; y: number };
export type PhotoTransform = PhotoPoint & { scale: number };
/** 원본을 viewport 안에 contain으로 맞춘 크기를 반환한다. */
export const containSize = ({ image, viewport }: { image: PhotoSize; viewport: PhotoSize }): PhotoSize => {
  if (image.width <= 0 || image.height <= 0) return { width: 0, height: 0 };
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
};
/** 확대 배율과 실제 contain 사진의 이동 범위를 제한한다. */
export const clampPhotoTransform = ({ scale, x, y, image, viewport }: PhotoTransform & { image: PhotoSize; viewport: PhotoSize }): PhotoTransform => {
  const nextScale = Math.max(1, Math.min(3, scale));
  const maxX = Math.max(0, (image.width * nextScale - viewport.width) / 2);
  const maxY = Math.max(0, (image.height * nextScale - viewport.height) / 2);
  return { scale: nextScale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
};
/** 시작 초점의 이미지 점이 현재 초점 아래에 남도록 배율과 이동을 계산한다. */
export const zoomAtPoint = ({ start, scale, origin, focal }: { start: PhotoTransform; scale: number; origin: PhotoPoint; focal: PhotoPoint }): PhotoTransform => {
  const nextScale = Math.max(1, Math.min(3, scale));
  const ratio = nextScale / start.scale;
  return { scale: nextScale, x: focal.x - (origin.x - start.x) * ratio, y: focal.y - (origin.y - start.y) * ratio };
};
/** 1배 스와이프의 방향·임계값·핀치 개입을 확인하고 순환 없이 다음 index를 반환한다. */
export const swipePhotoIndex = ({ index, count, width, x, y, pinched }: { index: number; count: number; width: number; x: number; y: number; pinched: boolean }): number => {
  if (pinched || Math.abs(x) < Math.max(48, width * 0.15) || Math.abs(x) < Math.abs(y) * 1.2) return index;
  return Math.max(0, Math.min(count - 1, index + (x < 0 ? 1 : -1)));
};
