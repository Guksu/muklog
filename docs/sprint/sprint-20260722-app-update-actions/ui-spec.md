# UI Spec: 설정 화면 업데이트 액션 — AppVersionRow 상태별 렌더 (app-update-actions T3)

> 담당: ui-publisher (T3). **킷 비종속 확장** — `templates/muklog`에 설정 업데이트 액션 시안 없음. 선행 스프린트 `app-version-gate`의 AppVersionRow(표시 전용)를 **상태별 렌더**로 확장한다. 기존 프리미티브·토큰·킷 톤(caption/fgMuted 보조 텍스트·accentStrong 액센트·해요체·헤어라인/언더라인)으로 정합, 근거를 파일:라인으로 남긴다.
> 경계: **비주얼·프리젠테이션·문구·분기 = ui-publisher / 데이터·판정·Linking 배선 = developer**. 상태·콜백은 전부 props로 노출.
> 단일 출처 정합: 상태 유니온 `AppUpdateStatus`는 **`useAppUpdateStatus`(developer, plan §3.2)** 소유. AppVersionRow는 `import type`으로 재사용(중복 정의 0).

---

## 0. 프리미티브·토큰 근거 (킷 비종속 → 정합 기준)

| 사용 | 프리미티브/토큰 | 파일:라인(근거) |
|----|----|----|
| 행 컨테이너 | `View`(중앙 정렬·비-pressable) | 기존 `AppVersionRow.tsx` 패턴 유지(회원탈퇴 행 톤) |
| 버전·라벨 텍스트 | `Text variant="caption" color="fgMuted"` | `Text.tsx:16` · 타이포 `caption`(12/Medium) `tokens.ts:221` · `fgMuted` `tokens.ts:104` |
| 업데이트 액션 색 | `Text color="accentStrong"` | `tokens.ts:98`(#1F4FE0) — UpdateSuggestModal "업데이트"와 동일 액센트 `UpdateSuggestModal.tsx:114` |
| 액션 어포던스(언더라인) | `textDecorationLine: 'underline'` | ProfileScreen 회원탈퇴 행 언더라인 `ProfileScreen.tsx:421`(deleteLabel)과 동일 패턴 |
| 프레스 피드백 | `opacity: 0.6` | UpdateSuggestModal action pressed `UpdateSuggestModal.tsx:150`와 동일 |
| 액션↔버전 간격 | `theme.spacing[6]` | 토큰 경유(raw 숫자 0) |

**색·톤 원칙:** 인앱 액센트는 **블루 유지**(`accentStrong` #1F4FE0 — 배지·CTA 텍스트·강조 전용, `tokens.ts:91` 주석). 코럴은 브랜드 마크 한정 → 여기선 미사용. raw hex 0(토큰만).

---

## 1. AppVersionRow (T3) — 상태별 렌더 확장

**파일:** `src/features/appVersion/AppVersionRow/AppVersionRow.tsx`

### 비주얼 골격 (기존 표시 행 + 상태별 하단 요소)
- 컨테이너 `View testID="app-version-row"` — `paddingVertical 12`·`alignItems center`(기존 유지, 회원탈퇴 행과 동일 최하단 약톤).
- 상단(항상): `Text variant="caption" color="fgMuted"` — **"앱 버전 {version}"**(기존 문구 verbatim, 회귀 0).
- 하단(상태별, `marginTop spacing[6]`):

| status | 스토어URL | 하단 요소 | 액션(role=button) |
|--------|-----------|-----------|-------------------|
| `checking` | — | 없음(버전만) | 없음 |
| `available` | 있음 | `Pressable`(testID `app-version-update`) + `Text caption/accentStrong` **"업데이트하기"**(언더라인) | 있음 → `onUpdatePress` |
| `available` | null | 없음(버전만 — Android 미출시 엣지) | 없음 |
| `latest` | — | `Text caption/fgMuted` **"최신 버전이에요"**(passive, 언더라인 없음) | 없음 |
| `unknown` | — | 없음(버전만, fail-open — 상태 주장 안 함) | 없음 |

### 확정 문구 (해요체·킷 톤)
- **업데이트 액션:** `업데이트하기` — accentStrong·언더라인(탭 가능 어포던스). UpdateSuggestModal의 "업데이트"(모달 버튼)와 액센트 색은 동일, 스케일은 설정 행 caption(12)으로 축소.
- **최신 라벨:** `최신 버전이에요` — passive 확인문. **fgMuted 유지**(액션 아닌 상태 표시 → 시각 위계상 가장 조용한 톤; success 대신 fgMuted로 "약톤 확인" 확정. 근거: plan §4 "passive·fgMuted/success 톤" 중 passive 우선, 초록 액센트는 aux 행에서 과함).

### 시각 위계 (기존 유지 + 추가)
로그아웃(카드·error) > 회원탈퇴(caption/fgMuted + 언더라인) > **앱 버전 행**(caption/fgMuted). 업데이트 액션은 앱 버전 행 안에서 accentStrong 언더라인으로 "탭 가능"만 신호(위계는 회원탈퇴 이하 유지 — 파괴 액션보다 강조하지 않음).

### RN 미재현/근사
- 없음(순수 텍스트·Pressable·토큰). 컬러 그림자·blur·그라데이션 미사용.

---

## 2. props 계약 (developer 인계 — T4 배선)

```ts
// src/features/appVersion/AppVersionRow/AppVersionRow.tsx
import type { AppUpdateStatus } from '../useAppUpdateStatus'; // 단일 출처(developer §3.2)

export type AppVersionRowProps = {
  /** 표시할 앱 버전(예: "1.2.0"). developer가 getCurrentAppVersion 값 주입. */
  version: string;
  /** 업데이트 상태 — 렌더 분기. developer가 useAppUpdateStatus에서 주입.
   *  미지정 시 checking(버전만) — 기존 소비처 후방호환(값 배선 전 회귀 0). */
  status?: AppUpdateStatus;
  /** "업데이트하기" 탭 콜백 — 스토어 Linking 배선은 ProfileScreen(expo-linking). */
  onUpdatePress?: () => void;
};
```

### developer 배선(비주얼 밖 — T4)
ProfileScreen에서 status/onUpdatePress를 **반드시 주입**해야 액션이 나타난다(미주입 시 checking=버전만, 액션 영구 미노출 — 잠재 버그 주의):
```tsx
const { status } = useAppUpdateStatus();                       // 신규(developer T2)
const openStore = ({ storeUrl }: { storeUrl: string | null }) => {
  if (!storeUrl) return;
  void Linking.openURL(storeUrl);                               // expo-linking(AppVersionGate.tsx:22-25 동일 패턴)
};
{appVersion ? (
  <AppVersionRow
    version={appVersion}
    status={status}
    onUpdatePress={() => { if (status.kind === 'available') openStore({ storeUrl: status.storeUrl }); }}
  />
) : null}
```

- **접근성:** 업데이트 액션 = `accessibilityRole="button"` + `accessibilityLabel="업데이트하기"` + `testID="app-version-update"`(컴포넌트 내장). 테스트는 role/testID/문구 기준.

### 계약 결정 — props 필수 vs 선택 (divergence 기록)
- plan §3.3은 `status`·`onUpdatePress`를 **required**로 명시. **ui-publisher는 optional(+`status` 기본 `{kind:'checking'}`)로 확정**한다.
  - **사유:** 병렬 공유 트리에서 developer T4 배선 전까지 기존 소비처 `<AppVersionRow version=.../>`(ProfileScreen.tsx:356)가 컴파일 유지 → **회귀 0·tsc green 유지**. checking 기본 = 기존과 동일(버전만) 렌더라 표시 회귀 없음.
  - **대가:** developer가 status 미주입 시 액션이 영구 미노출(위 굵은 주의). T4 테스트가 available 탭→openURL 1회를 단언해 방어(plan §5-1 T4).

---

## 3. 원티드 토큰 체크 (raw hex 0)

- 색 전부 토큰 경유: `fgMuted`·`accentStrong`. 신규 하드코딩 색 0.
- spacing: `12`(행 패딩, 기존 aux 행 verbatim)·`spacing[6]`(액션 간격 토큰). radius/shadow 미사용(순수 텍스트 행).
- 타이포: `caption` 역할 토큰만(버전·액션·라벨 동일 스케일 — aux 행 톤 일관).

---

## 4. 검증 (TDD)

### 단위(green) — `AppVersionRow.spec.tsx` (8/8)
- status 미지정(기본 checking) → "앱 버전 {v}"만·버튼 없음(후방호환).
- 다른 버전 문자열 표시.
- checking → 버전만·`app-version-update` 없음·버튼 없음.
- unknown → 버전만·"최신 버전이에요" 없음·버튼 없음(fail-open).
- available+storeUrl → `app-version-update`·"업데이트하기"·role button 노출.
- available+storeUrl → 탭 시 `onUpdatePress` 1회.
- available+storeUrl null → 버전만·버튼 없음(Android 미출시 엣지).
- latest → "최신 버전이에요" passive·버튼 없음.

**결과: AppVersionRow 8/8 green, appVersion 스코프 13 suites/80 tests green, tsc clean.**

### 디바이스 스모크 (qa-visual/qa-logic 인계)
- [ ] Profile 최하단 "앱 버전 1.2.0" 아래(현재 배포=latest) "최신 버전이에요" 약톤 표시.
- [ ] 운영자가 `latest_version` 임시 상향/낮은 current 빌드 → "업데이트하기"(accentStrong 언더라인) 노출, 탭 → iOS 스토어(먹로그) 이동.
- [ ] 라이트/다크 토큰 미러 정상(accentStrong·fgMuted 대비).

---

## 5. qa-visual 대조 포인트

- **킷 비종속** → 프리미티브·토큰 정합이 기준(§0 파일:라인 근거로 검증).
- 업데이트 액션 accentStrong(#1F4FE0)이 UpdateSuggestModal "업데이트"(`UpdateSuggestModal.tsx:114`)와 동일 액센트. 언더라인은 회원탈퇴 행(`ProfileScreen.tsx:421`)과 동일 어포던스.
- 최신 라벨 fgMuted passive — 회원탈퇴 행 대비 위계(액션 아님, 언더라인 없음).
- **회귀 0:** ProfileScreen 기존 레이아웃(아바타·통계·설정·로그아웃·회원탈퇴) 무변경. 앱 버전 행은 상태별 하단 요소 추가만.
