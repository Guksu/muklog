// src/features/muklog/reconcileMuklogPhotos.ts
// 사진 reconciliation 순수 계산 (plan §3.4 / §7 작업② b, 경계면 §8).
//
// 편집 저장 시 "현재 DB 상태(initial)"와 "에디터 최종 슬롯(next)"을 비교해 실행 계획 3집합을 만든다.
//   - 판정 키: existing은 storage_path(signed URL 만료 무관), new는 local uri(업로드 대상).
//   - 최종 배열 인덱스 = 새 order_index(0..N-1) — existing 유지분/new 모두 동일 규칙.
// 생산자: useUpdateMuklog가 이 계획을 받아 "삭제 → 신규 업로드 → reindex" 순으로 실행(plan §3.4).
// 소비자: useUpdateMuklog.
//
// 순수 함수(부수효과 0) — 단위 테스트로 유지/삭제/추가/reindex/0장/순서변경 조합을 검증한다.
import { type EditorPhoto, type ExistingPhoto } from './types';

/** reconciliation 계획 — useUpdateMuklog가 순서대로 실행한다. */
export type PhotoReconcilePlan = {
  /** initial에 있으나 next.existing에 없는 storage_path(× 눌러 제거된 기존 사진) → 행/파일 삭제. */
  toDelete: string[];
  /** next의 kind:'new' → 업로드 대상(최종 배열 인덱스 = order_index). */
  toAdd: { uri: string; orderIndex: number }[];
  /** 유지 existing 중 order_index가 바뀐 것만 → muklog_photos.update(order_index). */
  toReindex: { storagePath: string; orderIndex: number }[];
};

/**
 * 편집 전(initial)과 편집 후(next) 사진 슬롯을 비교해 실행 계획(삭제/추가/재정렬)을 만든다.
 * @param initial 현재 DB 사진(order_index 오름차순, storagePath 보유)
 * @param next 에디터 최종 슬롯(existing+new 혼합, 배열 인덱스 = 새 order_index)
 * @returns toDelete/toAdd/toReindex 3집합(부수효과 없음)
 */
export const planPhotoReconcile = ({
  initial,
  next,
}: {
  initial: ExistingPhoto[];
  next: EditorPhoto[];
}): PhotoReconcilePlan => {
  // next에서 유지된 existing의 storage_path 집합(유지/삭제 판정 기준).
  const keepPaths = new Set(
    next.filter((p): p is Extract<EditorPhoto, { kind: 'existing' }> => p.kind === 'existing').map(
      (p) => p.storagePath,
    ),
  );

  // toDelete: initial 중 keepPaths에 없는 것(× 눌러 제거). initial 순서 보존.
  const toDelete = initial
    .map((p) => p.storagePath)
    .filter((path) => !keepPaths.has(path));

  // initial의 storage_path → 현재 order_index 맵(reindex 변경 판정용).
  const initialOrderByPath = new Map(initial.map((p) => [p.storagePath, p.orderIndex]));

  const toAdd: PhotoReconcilePlan['toAdd'] = [];
  const toReindex: PhotoReconcilePlan['toReindex'] = [];

  next.forEach((slot, finalIndex) => {
    if (slot.kind === 'new') {
      toAdd.push({ uri: slot.uri, orderIndex: finalIndex });
      return;
    }
    // existing 유지분 — 최종 인덱스가 기존 order_index와 다르면 reindex 대상.
    const currentOrder = initialOrderByPath.get(slot.storagePath);
    if (currentOrder !== finalIndex) {
      toReindex.push({ storagePath: slot.storagePath, orderIndex: finalIndex });
    }
  });

  return { toDelete, toAdd, toReindex };
};
