# UI Spec: 앱 버전 확인·업데이트 안내 — 신설 UI 3종 (app-version-gate)

> 담당: ui-publisher (T8·T9·T10). **킷 비종속 신설** — `templates/muklog`에 버전 게이트 시안 없음. 기존 프리미티브·토큰·킷 톤(코럴 브랜드마크·헤어라인·해요체)으로 정합, 근거를 라인 참조로 남긴다(room-lifecycle 배너 선례와 동일 방식).
> 경계: **비주얼·프리젠테이션·placement = ui-publisher / 데이터·Linking·BackHandler·게이트 배선 = developer**. 데이터는 전부 props로 노출.
> 산출물: `src/features/appVersion/{ForceUpdateScreen,UpdateSuggestModal,AppVersionRow}/`(+ 각 spec·index) + 배럴 UI export.

---

## 0. 프리미티브·토큰 근거 (킷 비종속 → 정합 기준)

| 사용 | 프리미티브/토큰 | 파일:라인(근거) |
|----|----|----|
| 화면 셸 | `Screen center` | `src/components/Screen/Screen.tsx:18` (center=가운데 정렬, placeholder/로딩 화면용) |
| 브랜드 톤 캐리어 | `AppMark`(코럴 「먹 핀」) | `src/components/AppMark/AppMark.tsx:47` · 코럴 토큰 `tokens.ts:45-47`(brandGradTop/Bottom·brandMarkGlyph) |
| CTA | `Button variant="primary" size="lg" full` | `src/components/Button/Button.tsx:48` (primary=accent 블루+accentShadow) |
| 텍스트 | `Text variant/color` | `src/components/Text/Text.tsx:16` · 타이포 토큰 `tokens.ts:204-254` |
| 권유 모달 셸 | RenameDialog 셸 패턴 재사용 | `src/components/RenameDialog/RenameDialog.tsx:29-48,127-256`(딤·카드·2버튼 행 값) |

**색·톤 원칙(중요 divergence 판단):** 인앱 액센트는 **블루 유지**(primary Button=`#3366FF`), **코럴은 브랜드 마크(AppMark) 한정**. tokens.ts:29·94-97 주석이 "accentShadow(블루)는 인앱 primary 버튼 전용, 코럴은 브랜드 「먹 핀」 마크 그림자 한정"으로 명시 → plan §4.2 "브랜드 코럴"은 **AppMark로 코럴 톤을 캐리**하고 CTA는 인앱 블루로 해석(브랜드 규칙 위반 회피). raw hex 0(토큰만).

---

## 1. ForceUpdateScreen (T8) — 강제 업데이트 차단

**파일:** `src/features/appVersion/ForceUpdateScreen/ForceUpdateScreen.tsx`

### 비주얼 골격 (킷 톤 정합)
- `Screen center` + 중앙 콘텐츠 블록(`width:100%`, `maxWidth 320`, `alignItems center`).
- **AppMark `size={72}`**(코럴 브랜드 마크) — 킷 톤 캐리어.
- 제목 `Text variant="emptyTitle" color="fg"` center, `marginTop spacing[20]` — "업데이트가 필요해요".
- 본문 `Text variant="body" color="fgWeak"` center, `marginTop spacing[10]`, testID `force-update-body` — 해요체 "먹로그를 계속 사용하려면\n최신 버전으로 업데이트해 주세요.".
- **CTA 분기(storeUrl):**
  - `storeUrl` 있음 → `Button variant="primary" size="lg" full`, testID `force-update-button`, `marginTop spacing[28]`, 라벨 "업데이트하러 가기", `onPress={onUpdatePress}`.
  - `storeUrl === null` → 버튼 숨김 + 안내문 `Text variant="bodySm" color="fgMuted"` center, testID `force-update-guidance` — "앱스토어에서 먹로그를 최신 버전으로\n업데이트해 주세요."(차단은 유지, 미출시 상태).

### props 계약 (developer 인계)
```ts
type ForceUpdateScreenProps = {
  storeUrl: string | null;   // 플랫폼 스토어 URL(useAppVersionGate.state.storeUrl). null=미출시→버튼 숨김+안내문
  onUpdatePress: () => void;  // "업데이트하러 가기" 탭 → developer가 Linking.openURL(storeUrl) 배선(T11)
};
```
- **developer 배선(비주얼 밖):** ① `onUpdatePress`에 `Linking.openURL(storeUrl)`(expo-linking, T11) ② **Android 하드웨어백 no-op**(BackHandler) — 동작 영역이라 이 컴포넌트에 미포함(§디바이스 스모크). ③ AppVersionGate가 `force`일 때 자식 대신 이 화면 렌더(§plan 4.1).

---

## 2. UpdateSuggestModal (T9) — 업데이트 권유(닫기 가능)

**파일:** `src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.tsx`

### 셸 재사용 방식 결정 (plan §4.2 요구 — 근거 기록)
- **RenameDialog를 일반화/변형하지 않고 신규 컴포넌트로 구현.** 근거: `RenameDialog`는 `TextInput`(value/onChange·clear·maxLength)에 강결합(RenameDialog.tsx:50-77,180-204)이라, 입력 없는 확인형까지 흡수하려면 API가 비대해지고 **기존 2 소비처(LogScreen 로그명·ProfileScreen 닉네임) 회귀 위험**. 확인형은 입력이 없어 **셸(Modal·딤·카드·상단 hairline 2버튼 행)만** 필요 → 신규 컴포넌트가 저위험·저결합.
- **셸 값은 RenameDialog와 동기 유지**(킷 mk-extra RenameDialog 정합, RenameDialog.tsx:29-48와 동일 실값): 딤 `theme.color.fg`+opacity `0.34`(킷 rgba(20,12,8,.34) 근사), 카드 `width 84%`·`maxWidth 320`·`radius.sheet(20)`·`theme.shadow.dialog`, 버튼 행 `borderTopWidth hairline`+`buttonPadding 14`+`dividerWidth 1`.
- **차이 1건(근거 있는 divergence):** RenameDialog는 입력 키보드 회피용 상단~중앙 오프셋(`topOffset 70`, RenameDialog.tsx:34,138)을 쓰나, 본 모달은 **입력이 없어 수직 정중앙 배치**(`wrap: justifyContent center`). → 확인형 다이얼로그의 표준 위치.
- **미재현/근사(RenameDialog 계승):** backdrop blur·컬러 그림자 미지원 → 반투명 딤 + `shadow.dialog`(검정) 근사, `animationType="none"`(잔상 회피). RenameDialog.tsx:6-10 주석과 동일 사유.

### 비주얼 골격
- `Modal transparent animationType="none"` + 딤 `Pressable`(testID `update-suggest-backdrop`, 탭→onDismiss) + 정중앙 wrap(`pointerEvents box-none`) + 카드 `Pressable`(testID `update-suggest-card`, 전파 차단).
- 본문: 제목 `Text variant="dialogTitle" color="fg"` center "새 버전이 나왔어요" + 본문 `Text variant="dialogSubtitle" color="fgMuted"` center(`marginTop spacing[6]`) "더 좋아진 먹로그를 만나보세요.\n지금 업데이트할까요?".
- 버튼 행(상단 hairline, `hairlineAlt` 보더/divider):
  - `storeUrl` 있음 → **[나중에] │ [업데이트]**. 나중에=`dialogInput/fgWeak`(testID `update-suggest-dismiss`, onDismiss) · 업데이트=`button/accentStrong`(testID `update-suggest-update`, onUpdatePress).
  - `storeUrl === null` → **[확인] 단일**(testID `update-suggest-dismiss`, `button/accentStrong`, onDismiss). 업데이트 버튼 미렌더.

### props 계약 (developer 인계)
```ts
type UpdateSuggestModalProps = {
  visible: boolean;          // useAppVersionGate.state.status === 'suggest'
  storeUrl: string | null;   // null=업데이트 버튼 숨김+단일 확인
  onUpdatePress: () => void;  // "업데이트" 탭 → Linking.openURL(storeUrl)(T11)
  onDismiss: () => void;      // "나중에"/"확인"/딤 탭 → dismissSuggest()(버전당 1회 기록, developer)
};
```
- **developer 배선:** `onDismiss`=`useAppVersionGate.dismissSuggest`(saveDismissedVersion), `onUpdatePress`=Linking. AppVersionGate가 `suggest`일 때 자식+이 모달 오버레이.

---

## 3. AppVersionRow (T10) — Profile 앱 버전 행

**파일:** `src/features/appVersion/AppVersionRow/AppVersionRow.tsx`

### 비주얼 골격 + placement 확정
- `View`(testID `app-version-row`, `paddingVertical 12`·`alignItems center`, **비-pressable**) + `Text variant="caption" color="fgMuted"` — "앱 버전 {version}".
- **placement(확정):** ProfileScreen ScrollView 최하단, **회원 탈퇴 행(`ProfileScreen.tsx:353-362` deleteRow) 바로 아래**. 톤은 회원탈퇴 행과 동급 약톤(caption/fgMuted)이나 **언더라인 없음**(비-액션 표시 전용) → 시각 위계: 로그아웃(카드·error) > 회원탈퇴(underline caption) > 앱 버전(plain caption).

### developer 삽입(값 배선 = developer)
ProfileScreen `ScrollView` 안, 회원탈퇴 `Pressable` 다음에 삽입:
```tsx
import { AppVersionRow } from '@/features/appVersion';
import { getCurrentAppVersion } from '@/features/appVersion'; // developer currentAppVersion 모듈(있음)
// ...회원탈퇴 Pressable 아래:
{getCurrentAppVersion() ? <AppVersionRow version={getCurrentAppVersion() as string} /> : null}
```
- **props 계약:** `AppVersionRow({ version: string })` — 표시 전용. 버전 취득(`getCurrentAppVersion()`=expo-constants, `currentAppVersion.ts:` 이미 존재)·null 처리는 developer. null이면 행 미렌더(버전 미확보=표시 생략, fail-open 톤과 일관).

---

## 4. 원티드 토큰 체크 (raw hex 0)

- 색 전부 토큰 경유: `fg·fgWeak·fgMuted·surface·primary·accentStrong·hairlineAlt` + AppMark 내부 코럴은 `brandGradient`·`brandMarkGlyph` 토큰(AppMark 소유). **신규 하드코딩 색 0.**
- radius: 카드 `radius.sheet(20)`, 버튼 `radius.control(14)`(Button 내부). spacing: `10/16/18/20/28` 토큰. shadow: `shadow.dialog`(모달 카드)·`accentShadow`(primary 버튼, Button 내부).
- 타이포: `emptyTitle·body·bodySm·caption·dialogTitle·dialogSubtitle·dialogInput·button` 역할 토큰만.

---

## 5. 검증 (TDD + 디바이스 스모크)

### 단위(green) — 각 컴포넌트 spec
- `ForceUpdateScreen.spec.tsx`: 제목/본문/AppMark 렌더 · storeUrl 있음→버튼+onUpdatePress 호출·안내문 부재 · null→버튼 부재+안내문.
- `UpdateSuggestModal.spec.tsx`: visible 토글 · 제목/본문 · 업데이트/나중에/딤 탭 콜백 · null→업데이트 부재+단일 확인.
- `AppVersionRow.spec.tsx`: "앱 버전 {version}" 렌더 · 다른 버전 · 비-pressable(button role 부재).
- 결과: **appVersion 스코프 8/8 suites green(UI 3 + developer 로직 5), tsc clean.** (UI 3 suites = 내 담당.)

### 디바이스 스모크 (단위로 안 드러남 — qa-visual/qa 인계)
- [ ] ForceUpdateScreen이 화면 전체를 덮고(자식 대체) 스크롤/탭으로 우회 불가.
- [ ] **Android 하드웨어백이 no-op**(차단 유지) — developer BackHandler 배선 후 실기기 확인.
- [ ] 스토어 URL 있음→버튼 탭이 실제 스토어 앱/웹 오픈(Linking). null→버튼 없이 안내문만.
- [ ] UpdateSuggestModal 딤·중앙 카드·2버튼 행이 RenameDialog와 동일 톤(딤 농도·카드 radius·hairline)으로 보임.
- [ ] Profile 최하단 "앱 버전 x.y.z"가 회원탈퇴 아래에 약톤으로 표시(실제 expo-constants 버전값).
- [ ] 라이트/다크 모두 토큰 미러 정상(코럴 마크·딤·텍스트 대비).

---

## 6. qa-visual 대조 포인트

- **킷 비종속** → 프리미티브·토큰 정합이 기준(킷 라인 대신 위 §0 파일:라인 근거로 검증).
- ForceUpdateScreen: AppMark 코럴 톤이 인앱 블루 CTA와 공존(브랜드 규칙 준수, tokens.ts:29·94-97). 해요체 카피·중앙 정렬·storeUrl null 분기(버튼 vs 안내문).
- UpdateSuggestModal: RenameDialog 셸(RenameDialog.tsx:127-256)과 딤/카드/2버튼 행 **동일 값** 대조. 정중앙 배치(입력 없음 divergence) 확인.
- AppVersionRow: ProfileScreen deleteRow(ProfileScreen.tsx:425-427) 대비 약톤·언더라인 없음·placement(회원탈퇴 아래).
- **회귀 0:** ProfileScreen 기존 레이아웃(아바타·통계·설정·로그아웃·회원탈퇴)은 버전 행 추가 외 무변경. RenameDialog·Button·Screen·AppMark 프리미티브 무변경.
