// src/features/muklog/reconcileMuklogPhotos.spec.ts
// 사진 reconciliation 순수 계산 함수 명세 (plan §3.4 / §7 작업② b, §7-1 "reconcile 순수 함수").
//   planPhotoReconcile({ initial, next }) → { toDelete[], toAdd[{uri,orderIndex}], toReindex[{storagePath,orderIndex}] }.
//   판정 키 = storage_path(existing). new는 local uri(업로드 대상). 최종 배열 인덱스 = 새 order_index.
import { planPhotoReconcile } from './reconcileMuklogPhotos';
import { type EditorPhoto, type ExistingPhoto } from '../types';

const existing = ({
  path,
  order,
}: {
  path: string;
  order: number;
}): ExistingPhoto => ({ storagePath: path, orderIndex: order, uri: `signed://${path}` });

const keepSlot = ({ path }: { path: string }): EditorPhoto => ({
  kind: 'existing',
  storagePath: path,
  uri: `signed://${path}`,
});
const newSlot = ({ uri }: { uri: string }): EditorPhoto => ({ kind: 'new', uri });

describe('planPhotoReconcile', () => {
  it('유지만(existing 3, 순서 동일) → 세 집합 모두 빈 배열', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
      existing({ path: 'c', order: 2 }),
    ];
    const next: EditorPhoto[] = [
      keepSlot({ path: 'a' }),
      keepSlot({ path: 'b' }),
      keepSlot({ path: 'c' }),
    ];

    expect(planPhotoReconcile({ initial, next })).toEqual({
      toDelete: [],
      toAdd: [],
      toReindex: [],
    });
  });

  it('삭제만(중간 1장 제거) → toDelete=제거 path, 뒤따른 existing은 인덱스 당겨져 reindex', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
      existing({ path: 'c', order: 2 }),
    ];
    // b 제거 → [a(0 유지), c(2→1)]
    const next: EditorPhoto[] = [keepSlot({ path: 'a' }), keepSlot({ path: 'c' })];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual(['b']);
    expect(result.toAdd).toEqual([]);
    // a는 order 0 유지(reindex 불필요), c는 2→1 변경.
    expect(result.toReindex).toEqual([{ storagePath: 'c', orderIndex: 1 }]);
  });

  it('추가만(existing 2 + new 1) → toAdd=[{uri,orderIndex:2}], 삭제·reindex 없음', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
    ];
    const next: EditorPhoto[] = [
      keepSlot({ path: 'a' }),
      keepSlot({ path: 'b' }),
      newSlot({ uri: 'file://new1' }),
    ];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([{ uri: 'file://new1', orderIndex: 2 }]);
    expect(result.toReindex).toEqual([]);
  });

  it('혼합(existing 2 중 1 삭제 + new 1) → toDelete 1 + toAdd 1 + 유지분 reindex', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
    ];
    // a 삭제, b를 맨 앞으로(1→0), 그 뒤 new 1장(order 1).
    const next: EditorPhoto[] = [keepSlot({ path: 'b' }), newSlot({ uri: 'file://new1' })];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual(['a']);
    expect(result.toAdd).toEqual([{ uri: 'file://new1', orderIndex: 1 }]);
    expect(result.toReindex).toEqual([{ storagePath: 'b', orderIndex: 0 }]);
  });

  it('0장(existing 전부 삭제) → toDelete=전체, toAdd/toReindex 빈 배열', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
    ];
    const next: EditorPhoto[] = [];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual(['a', 'b']);
    expect(result.toAdd).toEqual([]);
    expect(result.toReindex).toEqual([]);
  });

  it('순서변경(existing 순서 뒤집기) → toReindex 전부, toDelete/toAdd 없음', () => {
    const initial: ExistingPhoto[] = [
      existing({ path: 'a', order: 0 }),
      existing({ path: 'b', order: 1 }),
      existing({ path: 'c', order: 2 }),
    ];
    // 뒤집기: c(2→0), b(1 유지), a(0→2).
    const next: EditorPhoto[] = [
      keepSlot({ path: 'c' }),
      keepSlot({ path: 'b' }),
      keepSlot({ path: 'a' }),
    ];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([]);
    // b는 order 1 유지(reindex 제외). a/c만 변경.
    expect(result.toReindex).toEqual([
      { storagePath: 'c', orderIndex: 0 },
      { storagePath: 'a', orderIndex: 2 },
    ]);
  });

  it('신규를 앞에 두고 existing이 뒤로 밀리면 new orderIndex와 existing reindex가 함께 계산된다', () => {
    const initial: ExistingPhoto[] = [existing({ path: 'a', order: 0 })];
    // [new(0), a(0→1)]
    const next: EditorPhoto[] = [newSlot({ uri: 'file://n' }), keepSlot({ path: 'a' })];

    const result = planPhotoReconcile({ initial, next });
    expect(result.toDelete).toEqual([]);
    expect(result.toAdd).toEqual([{ uri: 'file://n', orderIndex: 0 }]);
    expect(result.toReindex).toEqual([{ storagePath: 'a', orderIndex: 1 }]);
  });
});
