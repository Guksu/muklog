// src/components/PhotoViewer/photoViewerIndex.ts
// 사진 뷰어의 인덱스 계산(순수 — 렌더 없이 단위 테스트된다). photo-viewer plan §3.2.
//   뷰어가 "몇 번째 사진을 보고 있는가"를 정하는 두 경로를 한 파일에 모은다:
//     · 열 때  — 호출자가 준 initialIndex를 목록 범위로 접는다(clampPhotoIndex).
//     · 넘길 때 — 스크롤 오프셋을 페이지 번호로 환산한다(resolvePageIndex).
//   둘 다 같은 클램프 규칙을 공유해야 카운터가 목록 밖 숫자(0 / 5, 6 / 5)를 띄우지 않는다.

/**
 * 뷰어가 실제로 열 인덱스를 0~count-1로 접는다.
 *   범위 밖·음수·소수·NaN을 모두 흡수한다 — 잘못된 입력이 크래시나 빈 화면이 되지 않게 한다(plan E4).
 * @param index 호출자가 준 0-based 인덱스(신뢰하지 않는다)
 * @param count 사진 개수
 * @returns 0~count-1 사이의 정수. count가 0이면 0(호출부가 렌더 자체를 막는다)
 */
export const clampPhotoIndex = ({ index, count }: { index: number; count: number }): number => {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.floor(index), 0), count - 1);
};

/**
 * 가로 스크롤 오프셋을 현재 페이지 번호로 환산한다.
 *   페이지 폭은 뷰어가 실제로 측정한 값(layoutMeasurement.width)을 쓴다 — 창 크기를 가정하지 않아
 *   분할 화면·태블릿에서도 맞고, 폭이 0으로 보고되는 첫 프레임에서 NaN 카운터가 생기지 않는다(plan E12).
 * @param offsetX 트랙의 가로 스크롤 오프셋(px)
 * @param pageWidth 한 페이지의 폭(px)
 * @param count 사진 개수
 * @returns 0~count-1 사이의 페이지 번호
 */
export const resolvePageIndex = ({
  offsetX,
  pageWidth,
  count,
}: {
  offsetX: number;
  pageWidth: number;
  count: number;
}): number => {
  if (pageWidth <= 0) return 0;
  return clampPhotoIndex({ index: Math.round(offsetX / pageWidth), count });
};
