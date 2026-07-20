// src/features/muklog/types.ts
// 먹로그 도메인 타입 단일 출처 (plan §5.2·§5.3).
//   Muklog = 조회/카드가 소비하는 camelCase 형. CreateMuklogInput = 입력 시트가 만드는 원본 입력.
//   NormalizedMuklogInput = validate가 정규화/검증을 통과시킨 형(row 빌더 입력).
import { type MuklogCategoryKey } from '../categories';

/** 조회된 먹로그 1건(camelCase). useMuklogs가 snake row를 toMuklog로 매핑해 노출. */
export type Muklog = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null; // CAT key(8종) | null
  area: string | null;
  memo: string | null;
  rating: number | null; // 1~5, 0.5 단위
  visitedAt: string | null; // 'YYYY-MM-DD'
  createdBy: string | null; // uuid | null(탈퇴자 익명화 — ON DELETE SET NULL, plan §1·§5)
  createdAt: string; // ISO
  // 사진(muklog-photos) — 카드 커버/장수. developer가 useMuklogs 임베드+signed URL로 채운다(plan §3.5).
  photoCount: number; // 0~5
  coverUri: string | null; // 대표(order_index 0) signed URL. null이면 FoodCover 폴백(plan §6.2)
};

export type MuklogsState =
  | { status: 'loading' }
  | { status: 'ready'; muklogs: Muklog[] } // [] = 빈 상태(정상)
  | { status: 'error'; message: string };

// ── 장소검색(muklog-place) — Edge Function 응답 항목 + 자동채움 (plan §3.2·§3.7) ───────────────
//   생산자: place-search Edge Function이 Kakao raw를 camelCase로 정규화해 { results: PlaceSearchItem[] } 반환.
//   소비자: searchPlaces(invoke 래퍼) → usePlaceSearch → MuklogEntrySheet 결과 리스트.

/** 장소검색 UI 상태(plan §4.2) — usePlaceSearch.status와 PlaceSearchView/MuklogEditor가 공유하는 단일 출처. */
export type PlaceSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** place-search 응답 1건(camelCase 정규화 — 클라가 Kakao snake/x·y shape에 의존하지 않게 디커플). */
export type PlaceSearchItem = {
  kakaoPlaceId: string; // Kakao documents[].id
  placeName: string; // place_name
  categoryName: string; // category_name (raw, 예 "음식점 > 한식 > 칼국수")
  categoryGroupCode: string; // category_group_code (FD6/CE7/'')
  addressName: string; // address_name (지번)
  roadAddressName: string; // road_address_name ('' 가능)
  lat: number; // parseFloat(y) 위도
  lng: number; // parseFloat(x) 경도
  phone: string; // phone ('' 가능)
};

/** 공통 place 필드 묶음(작성·편집·정규화·프리필이 공유). 좌표는 nullable(수동입력 폴백). */
export type PlaceFields = {
  kakaoPlaceId?: string | null;
  address?: string | null;
  roadAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/** 장소 선택 시 입력에 머지하는 자동채움값(placeName·category·area 포함). placeFieldsFromItem 산출(plan §4.1·D1·D2). */
export type PlaceSelection = {
  placeName: string;
  category: MuklogCategoryKey | null; // 매핑 실패 시 null(사용자 칩 수동 선택)
  area: string | null;
  address: string | null;
  roadAddress: string | null;
  kakaoPlaceId: string | null;
  lat: number | null;
  lng: number | null;
};

/** 시트가 고른 로컬 사진 자산(업로드 전). uri만 — 처리/업로드는 훅 책임(plan §3.5). */
export type PickedPhoto = { uri: string };

/** 입력 시트가 만드는 원본 입력(검증 전). place 필드(plan §3.7)는 PlaceFields로 합성. */
export type CreateMuklogInput = {
  roomId: string;
  placeName: string; // 필수, trim 후 비면 차단
  category?: string | null; // CAT key
  area?: string | null;
  rating?: number | null; // 1~5, 0.5 단위(0/null=미평가)
  memo?: string | null;
  visitedAt?: string | null; // 'YYYY-MM-DD', 기본 today, 미래 차단
  photos?: PickedPhoto[]; // 0~5장, 선택 순서 = order_index. 업로드/insert는 developer(useCreateMuklog)
} & PlaceFields;

// ── 편집(muklog-edit) — 프리필 원본 + 에디터 사진 슬롯 (plan §3.2) ───────────────────
//   UI(ui-publisher)는 ExistingPhoto/EditorPhoto/MuklogEditInitial을 소비·생성한다.
//   update 호출 입력(UpdateMuklogInput)·reconciliation은 developer 영역(useUpdateMuklog).

/** 편집 진입 시 프리필 원본 사진(remote 자산). 상세 조회(useMuklog) 결과에서 파생. */
export type ExistingPhoto = {
  storagePath: string; // 'roomId/muklogId/uuid.jpg' — reconciliation 키(유지/삭제 판정)
  orderIndex: number; // 현재 order_index
  uri: string; // 표시용 signed URL
};

/** 에디터가 다루는 사진 슬롯 — 기존(existing) | 신규(new) 합집합. 최종 배열 인덱스 = 새 order_index. */
export type EditorPhoto =
  | { kind: 'existing'; storagePath: string; uri: string } // 유지 후보(× → 배열에서 제거 = 삭제)
  | { kind: 'new'; uri: string }; // 신규 pick(local uri) — 업로드 대상

/** 편집 시트(MuklogEntrySheet) initial 프리필 데이터. developer가 useMuklog 결과를 매핑해 주입.
 *  place 필드(plan §3.7·§6 편집 좌표 보존)는 PlaceFields로 합성 — 재검색 없이 저장해도 좌표 손실 0. */
export type MuklogEditInitial = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  memo: string | null;
  visitedAt: string | null; // 'YYYY-MM-DD'
  photos: ExistingPhoto[]; // order_index 오름차순
} & PlaceFields;

/** update 입력(필드 + 최종 사진 슬롯 배열). 최종 배열 순서 = 새 order_index(0..N-1) (plan §3.2). place 필드 포함. */
export type UpdateMuklogInput = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category?: string | null;
  area?: string | null;
  rating?: number | null;
  memo?: string | null;
  visitedAt?: string | null;
  photos: EditorPhoto[]; // 0~5. existing(유지) + new(신규)가 섞인 최종 순서
} & PlaceFields;

/** validate를 통과한 정규화 입력(row 빌더 입력). place 필드는 정규화 후 비-optional(null 명시). */
export type NormalizedMuklogInput = {
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  memo: string | null;
  visitedAt: string;
  kakaoPlaceId: string | null;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
};
