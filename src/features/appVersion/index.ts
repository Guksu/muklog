// src/features/appVersion — 앱 버전 게이트 기능 표면
// ⚠️ ui-publisher 소유 = UI 프리젠테이션 3종(아래). developer는 로직 모듈
//    (compareVersion·resolveVersionGate·fetchAppConfig·updateSuggestDismissal·useAppVersionGate·AppVersionGate)
//    export를 이 배럴에 "추가"한다(기존 UI export 유지 — 병합, 대체 아님).
export { ForceUpdateScreen, type ForceUpdateScreenProps } from './ForceUpdateScreen';
export { UpdateSuggestModal, type UpdateSuggestModalProps } from './UpdateSuggestModal';
export { AppVersionRow, type AppVersionRowProps } from './AppVersionRow';

// developer 슬라이스 A — 로직 모듈(순수 유틸·조회·영속·버전 취득). 배선(useAppVersionGate·AppVersionGate)은 슬라이스 B.
export { compareVersion } from './compareVersion';
export { resolveVersionGate, VersionGateDecision } from './resolveVersionGate';
export { fetchAppConfig, type AppConfig } from './fetchAppConfig';
export { getCurrentAppVersion } from './currentAppVersion';
export {
  UPDATE_SUGGEST_DISMISSED_KEY,
  loadDismissedVersion,
  saveDismissedVersion,
} from './updateSuggestDismissal';

// 슬라이스 B — 게이트 훅·래퍼(App.tsx가 AuthGate를 AppVersionGate로 래핑).
export { useAppVersionGate, type VersionGateState } from './useAppVersionGate';
export { AppVersionGate, type AppVersionGateProps } from './AppVersionGate';
