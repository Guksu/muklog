// src/features/muklog/usePlaceSelection.ts
// 장소 선택 상태 훅 — 컨테이너(MuklogList 작성 / MuklogDetailRoute 편집)가 소유 (plan §5.4·D1·D2, ui-spec §5).
//   생산자: usePlaceSearch 결과 항목(PlaceSearchItem). 소비자: MuklogEntrySheet의 selectedPlace/onSelectPlace/onClearPlace.
//   선택 표시는 컨테이너 controlled(이 훅), payload 합류·자동채움 동기화는 시트가 selectedPlace를 받아 수행(역할 분리).
import { useState } from 'react';

import { placeFieldsFromItem } from '../kakaoCategory';
import { type PlaceSearchItem, type PlaceSelection } from '../types';

export type UsePlaceSelectionResult = {
  selectedPlace: PlaceSelection | null;
  selectPlace: ({ item }: { item: PlaceSearchItem }) => void;
  clearPlace: () => void;
};

/**
 * 장소 선택 상태를 보유하는 컨테이너 훅. 결과를 고르면 자동채움값(PlaceSelection)을 보관하고,
 * 해제하면 null로 되돌린다(요약카드 토글 + 시트 payload 합류의 단일 출처).
 * @param initial 초기 선택값(예: 위시 "다녀왔어요" prefill). 미지정 시 null(기존 동작). useState 초기값으로 1회만 시드.
 * @returns selectedPlace + selectPlace/clearPlace
 */
export const usePlaceSelection = ({
  initial,
}: { initial?: PlaceSelection | null } = {}): UsePlaceSelectionResult => {
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(initial ?? null);

  const selectPlace = ({ item }: { item: PlaceSearchItem }) => {
    setSelectedPlace(placeFieldsFromItem({ item }));
  };

  const clearPlace = () => {
    setSelectedPlace(null);
  };

  return { selectedPlace, selectPlace, clearPlace };
};
