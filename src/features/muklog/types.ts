// src/features/muklog/types.ts
// 먹로그 도메인 타입 단일 출처 (plan §5.2·§5.3).
//   Muklog = 조회/카드가 소비하는 camelCase 형. CreateMuklogInput = 입력 시트가 만드는 원본 입력.
//   NormalizedMuklogInput = validate가 정규화/검증을 통과시킨 형(row 빌더 입력).

/** 조회된 먹로그 1건(camelCase). useMuklogs가 snake row를 toMuklog로 매핑해 노출. */
export type Muklog = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key(8종) | null
  area: string | null;
  memo: string | null;
  rating: number | null; // 1~5
  visitedAt: string | null; // 'YYYY-MM-DD'
  createdBy: string; // uuid
  createdAt: string; // ISO
  // 사진(muklog-photos) — 카드 커버/장수. developer가 useMuklogs 임베드+signed URL로 채운다(plan §3.5).
  photoCount: number; // 0~5
  coverUri: string | null; // 대표(order_index 0) signed URL. null이면 FoodCover 폴백(plan §6.2)
};

export type MuklogsState =
  | { status: 'loading' }
  | { status: 'ready'; muklogs: Muklog[] } // [] = 빈 상태(정상)
  | { status: 'error'; message: string };

/** 시트가 고른 로컬 사진 자산(업로드 전). uri만 — 처리/업로드는 훅 책임(plan §3.5). */
export type PickedPhoto = { uri: string };

/** 입력 시트가 만드는 원본 입력(검증 전). */
export type CreateMuklogInput = {
  roomId: string;
  placeName: string; // 필수, trim 후 비면 차단
  category?: string | null; // CAT key
  area?: string | null;
  rating?: number | null; // 1~5(0/null=미평가)
  memo?: string | null;
  visitedAt?: string | null; // 'YYYY-MM-DD', 기본 today, 미래 차단
  photos?: PickedPhoto[]; // 0~5장, 선택 순서 = order_index. 업로드/insert는 developer(useCreateMuklog)
};

/** validate를 통과한 정규화 입력(row 빌더 입력). */
export type NormalizedMuklogInput = {
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  memo: string | null;
  visitedAt: string;
};
