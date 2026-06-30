# Dev Notes — sprint-20260630-brand-coral

## 데이터·로직 배선: 없음
이 스프린트는 **순수 브랜드 비주얼·에셋·토큰 전환**으로, 별도 developer 단계(데이터·훅·쿼리·Edge Function·네비게이션 배선)가 없다. 구현 전량을 ui-publisher가 수행(킷→RN 토큰·프리미티브·화면 골격). 생산자↔소비자 경계면 신규 없음.

- DB·RPC·Edge Function·RLS: **변경 없음**.
- 네비게이션 계약: 변경 없음(SplashView/LoginScreen은 AuthGate가 props 없이 소비하는 기존 계약 유지).
- AppMark props 계약(size/radius/bg/tint/style): **불변** — 소비처 SplashView·LoginScreen만 존재, 둘 다 함께 갱신.

## 에셋 처리 (리더 수행)
킷 코럴 에셋 3종을 `.claude/skills/ui-design/assets/` → 프로젝트 `assets/`로 복사·덮어쓰기. 동명 교체라 구 블루 잔존 없음.

## 네이티브 재빌드 필요 (완료 기준)
app.json(adaptiveIcon 배경·splash 플러그인)·아이콘·스플래시 PNG는 네이티브 자산 → **OTA 반영 불가**. dev build(`npm run ios:sim` / EAS) 재빌드 후 실기기에서 런처 아이콘·스플래시 코럴 확인이 완료 기준.

상세 킷↔RN 매핑·토큰표·근사 사유는 `ui-spec.md` 참조.
