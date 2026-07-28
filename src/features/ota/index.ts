// src/features/ota — EAS Update(OTA) 기능 표면 (expo-updates-ota plan §9-1).
// ⚠️ ui-publisher 소유 = OtaReadyDialog(안내 UI). developer 소유 = 로더·판정·훅·게이트.
export { OtaReadyDialog, type OtaReadyDialogProps } from './OtaReadyDialog';

// 로직 — 안전 로더(네이티브 미탑재 시 no-op) · 순수 판정 · 콜드스타트 1회 상태머신.
export { loadUpdatesModule, type UpdatesModule } from './updatesModule';
export { shouldCheckOta } from './shouldCheckOta';
export { useOtaUpdate, OtaStatus, type OtaUpdateState } from './useOtaUpdate';

// 배선 — App.tsx가 AppVersionGate 안쪽에서 AuthGate를 감싼다(두 축 우선순위 §4.2).
export { OtaUpdateGate, type OtaUpdateGateProps } from './OtaUpdateGate';
