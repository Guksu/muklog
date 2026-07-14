// src/features/wishlist/useAddNearbyWish.ts
// 주변 음식점 위시 담기 오케스트레이션 훅 (plan §3.3·§4 / T3·T4·T5, 경계면 §7-1·2·3·4·7).
//
// 생산자: NearbySpotCard 액션 → requestAdd({ item }). 내 로그 목록(useMyLogsContext)·중복 pre-check(wishlistExists)·
//   insert(useAddWishlist)·전역 토스트(useToastController)를 배선한다. 신규 마이그레이션/RPC/Realtime 없음(비용 가드 §8).
// 소비자: MapTabScreen이 NearbySpotCard 액션·로그 선택 시트에 배선(Phase 2, ui-spec 확정 후).
//
// 분기(plan §4.1): 로그 0개 → 안내 토스트(insert 미발생) / 1개 → 시트 없이 즉시 담기 / 2+개 → 선택 시트(choosing) 노출.
// 담기(addToLog): 중복 pre-check → 있으면 중복 토스트(insert 스킵) / 없으면 nearbyToWishlistInput 매핑 후 insert →
//   성공 토스트. 실패(pre-check/insert reject)면 mapWishlistError 토스트, 목록·상태 불변.
// loading 가드: submittingRef로 연속 탭 중복 insert 차단(동기 진입 차단 — state 비동기 갱신 레이스 회피, plan §4.2).
import { useRef, useState } from 'react';

import { useToastController } from '@/components';
import { type NearbyPlaceItem } from '@/features/map/types';
import { useMyLogsContext, type MyLog } from '@/features/room';

import { mapWishlistError } from '../errors';
import { nearbyToWishlistInput } from '../nearbyToWishlistInput';
import { useAddWishlist } from '../useAddWishlist';
import { wishlistExists } from '../wishlistExists';

/** 담기 결과 토스트 카피(해요체). 단일 출처.
 *   성공 카피의 📍는 킷 mk-log:40("위시리스트에 담았어요 📍") 웜 톤 정합 — ui-publisher/qa-visual 최종 확정.
 *   (muklog 웜 변형은 킷의 음식/플레이풀 이모지를 명시 허용 — CLAUDE.md.) */
export const NEARBY_WISH_COPY = {
  success: '위시에 담았어요 📍',
  duplicate: '이미 담은 곳이에요',
  noLog: '먼저 로그를 만들어 주세요',
} as const;

/** 로그 선택 시트 상태 — 담을 item + 선택 대상 로그 목록. null이면 시트 닫힘(로그 0/1개는 시트 없이 처리). */
export type NearbyWishChoosing = {
  item: NearbyPlaceItem;
  logs: MyLog[];
};

/**
 * 주변 음식점 카드의 "위시에 담기" 흐름을 오케스트레이션한다.
 * @param onAdded 담기 성공(insert 완료) 직후 콜백 — map-wish-pins에서 위시 핀 즉시 refresh 배선(선택).
 * @returns requestAdd(액션 진입)·chooseLog(시트 선택)·dismiss(시트 취소)·choosing(시트 상태)·submitting(로딩 가드)
 */
export const useAddNearbyWish = ({ onAdded }: { onAdded?: () => void } = {}) => {
  const { state } = useMyLogsContext();
  const { showToast } = useToastController();
  const { addWishlist } = useAddWishlist();

  const [choosing, setChoosing] = useState<NearbyWishChoosing | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 동기 재진입 차단(state는 비동기 갱신이라 연속 탭 레이스를 못 막음 — ref로 즉시 잠근다).
  const submittingRef = useRef(false);

  const logs: MyLog[] = state.status === 'ready' ? state.logs : [];

  const addToLog = async ({ item, roomId }: { item: NearbyPlaceItem; roomId: string }) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const kakaoPlaceId = item.kakaoPlaceId;
      const duplicate = await wishlistExists({ roomId, kakaoPlaceId });
      if (duplicate) {
        showToast({ message: NEARBY_WISH_COPY.duplicate, tone: 'neutral' });
        return;
      }
      await addWishlist({ input: nearbyToWishlistInput({ item, roomId }) });
      showToast({ message: NEARBY_WISH_COPY.success, tone: 'positive' });
      onAdded?.(); // map-wish-pins: 담기 성공 직후 위시 핀 즉시 refresh(같은 화면 반영). 미전달이면 no-op(스프린트1 회귀 0).
    } catch (err) {
      showToast({ message: mapWishlistError({ error: err }), tone: 'neutral' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const requestAdd = ({ item }: { item: NearbyPlaceItem }) => {
    if (submittingRef.current) return;
    if (logs.length === 0) {
      showToast({ message: NEARBY_WISH_COPY.noLog, tone: 'neutral' });
      return;
    }
    if (logs.length === 1) {
      void addToLog({ item, roomId: logs[0].roomId });
      return;
    }
    setChoosing({ item, logs });
  };

  const chooseLog = ({ roomId }: { roomId: string }) => {
    if (!choosing) return;
    const { item } = choosing;
    setChoosing(null);
    void addToLog({ item, roomId });
  };

  const dismiss = () => setChoosing(null);

  return { requestAdd, chooseLog, dismiss, choosing, submitting };
};
