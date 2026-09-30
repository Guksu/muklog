// src/features/appVersion/appStoreLinks/appStoreLinks.tsx
// 스토어 링크 컨텍스트 (invite-share U72, plan §4.3 · AC4) — additive(appVersionGateStatus 선례).
//   생산자: AppVersionGate(useAppVersionGate가 콜드스타트 1회 조회한 app_config.store_url_ios를 자식에게 제공).
//   소비자: useInviteShare(초대 메시지의 "앱 받기" 링크 — 추가 조회 0).
//   기본값 null: Provider 밖(기존 화면·테스트)이나 조회 전·실패면 null → 소비처가 폴백 상수로 안전하게 동작한다.
//   컨텍스트 값은 문자열(원시값)이라 게이트가 다시 그려져도 링크가 같으면 소비처가 다시 그려지지 않는다.
import React, { createContext, useContext, type ReactNode } from 'react';

/** 초대 메시지 등에 싣는 스토어 링크(Android는 미출시라 없음). */
export type AppStoreLinks = { storeUrlIos: string | null };

const StoreUrlIosContext = createContext<string | null>(null);

export type AppStoreLinksProviderProps = {
  /** 게이트가 조회한 iOS 스토어 링크(조회 전·실패면 null). */
  storeUrlIos: string | null;
  children: ReactNode;
};

export const AppStoreLinksProvider = ({ storeUrlIos, children }: AppStoreLinksProviderProps) => (
  <StoreUrlIosContext.Provider value={storeUrlIos}>{children}</StoreUrlIosContext.Provider>
);

/**
 * 버전 게이트가 이미 받아 둔 스토어 링크를 읽는다(네트워크 0).
 * @returns { storeUrlIos } — Provider 밖이면 { storeUrlIos: null }
 */
export const useAppStoreLinks = (): AppStoreLinks => ({ storeUrlIos: useContext(StoreUrlIosContext) });
