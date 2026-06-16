# UI Spec — 이름변경 다이얼로그 (rename-dialog)

> 작성: ui-publisher · 날짜: 2026-06-16 · 슬러그 `sprint-20260616-rename-dialog`
> 단일 출처(SSOT): 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx` `RenameDialog`(24-64)
> 입력: `plan.md`(스코프 D-1~D-7·§4.2 props 계약·§4.3 비주얼 계약), `src/theme/tokens.ts`
> 산출물: `src/components/RenameDialog.tsx`(+spec), `src/components/index.ts`(export), `src/theme/tokens.ts`(토큰 3+1 추가)

본 스프린트의 퍼블리싱 범위는 **공용 프리미티브 `RenameDialog` 비주얼 껍데기 + props 계약**까지다.
로그명/닉네임 배선·draft 소유·초대코드 솔로 분기·`LogNameSheet` 폐기·`LogTitleButton` 재배선은 **developer 몫**(plan §5·§6 T2~T4).

---

## 0. 결정 기록 — props 네이밍 (중요, developer/qa 합의 필요)

팀리드 인계 메시지의 약식 props(`{ visible; onChangeText; ... }`(RN 명명))와 plan §4.2 정식 계약(`{ open; onChange; + saving/error/saveDisabled }`)이 네이밍에서 충돌했다. **킷(SSOT) 정합 + qa-logic 교차검증 일관성**을 근거로 **plan §4.2 전체 계약을 채택**한다.

| 후보 | 채택 | 근거 |
|------|------|------|
| `open` vs `visible` | **`open`** | 킷 `mk-extra:24`가 `open` verbatim. plan §4.2·§8.1 qa-logic 체크가 `open`/`onChange` 기준. |
| `onChange` vs `onChangeText` | **`onChange(next: string)`** | 킷 `mk-extra:24,43`가 `onChange`. controlled 계약 단일 출처. (내부적으로 RN `TextInput.onChangeText`에 그대로 연결.) |
| 약식(5 props) vs 정식(13 props) | **정식(plan §4.2)** | 약식엔 `saving`/`error`/`saveDisabled` 부재 → plan AC1.5·AC1.8·AC2.4·AC3.6 검증 불가. 정식이 ACs와 정합. |

> developer는 LogScreen/ProfileScreen에서 `open`·`onChange`·`onSave`·`onCancel`로 배선한다(아래 §4 계약). 약식 명칭(`visible`/`onChangeText`)은 사용하지 않는다.

---

## 1. 킷 라인 ↔ RN 매핑 (mk-extra.jsx:24-64)

| 킷 라인 | 킷 내용 | RN 매핑 (`RenameDialog.tsx`) | 비고 |
|--------|--------|------------------------------|------|
| 25 | `if (!open) return null` | `if (!open) return null` | 미렌더(Modal 미마운트). |
| 30-34 | 오버레이 `position:absolute; inset:0; flex column; alignItems center; justifyContent flex-start; paddingTop ESP+70; background rgba(20,12,8,.34)` | `Modal`(transparent, fade) + `Pressable` 딤(`absoluteFill`, `bg=color.fg` opacity `0.34`) + 래퍼 `View`(flex1, alignItems center, `paddingTop = insets.top + 70`) | 딤·중앙 배치 근사(§2). |
| 30 | `onClick={cancel}`(딤 탭 닫기) | 딤 `Pressable onPress={onCancel}`, 래퍼 `pointerEvents="box-none"` | 카드 밖 터치→딤 전달. |
| 35-38 | 카드 `width 84%; maxWidth 320; background var(--mk-card); borderRadius 20; overflow hidden; boxShadow 0 20px 50px rgba(0,0,0,.28)` | 카드 `Pressable`: `width '84%'`, `maxWidth 320`, `bg=color.surface`, `borderRadius=radius.sheet(20)`, `overflow hidden`, `shadow.dialog` | `--mk-card`=surface. |
| 35 | `onClick={stopPropagation}`(카드 탭 미닫힘) | 카드 `Pressable onPress={() => {}}`(별도 레이어로 전파 차단) | 딤과 형제 레이어. |
| 39 | 본문 `padding "20px 18px 16px"` | `paddingTop spacing[20]` / `paddingHorizontal spacing[18]` / `paddingBottom spacing[16]` | 그리드 토큰 정합. |
| 40 | `h3` 제목 `font 800 17.5px/1.3 var(--font-sans); color var(--mk-ink); textAlign center` | `Text variant="dialogTitle" color="fg"` + `textAlign center` | **신규 토큰 dialogTitle**(§3). `--mk-ink`=fg. |
| 41 | subtitle `font 500 12.5px/1.5; color var(--text-alternative); margin "6px 0 0"; textAlign center` | `Text variant="dialogSubtitle" color="fgMuted"` + `marginTop spacing[6]` + center | **신규 토큰 dialogSubtitle**. `--text-alternative`≈fgMuted. |
| 42 | 입력 컨테이너 `gap 8; border 1.5px solid var(--mk-accent); borderRadius 12; padding "2px 4px 2px 14px"; background var(--mk-bg); marginTop 15` | 입력 행 `flexDirection row; alignItems center; gap 8`, `borderWidth 1.5` `borderColor=color.primary`, `borderRadius=radius.lg(12)`, `bg=color.bg`, `paddingVertical 2`/`paddingLeft 14`/`paddingRight 4`, `marginTop 15` | `--mk-accent`=primary, `--mk-bg`=bg. 1.5/2/14/4/15는 컨트롤 내부 수치(상수). 패딩 = 킷 `2px 4px 2px 14px` verbatim. |
| 43-46 | `<input value onChange maxLength autoFocus placeholder onKeyDown(Enter→save)>` `font 600 16px/1.2; color var(--mk-ink); padding "11px 0"` | `TextInput value onChangeText={onChange} maxLength autoFocus onSubmitEditing={handleSave} returnKeyType="done"`, style `typography.dialogInput` + `color.fg` + `paddingVertical 11` | **신규 토큰 dialogInput**(600/16). Enter→onSubmitEditing. |
| 47-51 | `value` 있으면 X 버튼: `background var(--fill); 24×24; borderRadius 999; marginRight 6` + `<MkIcon close size 12 color text-alternative>` | `value &&` `Pressable`(`bg=color.hairlineAlt`, 24×24, `borderRadius 12`, `marginRight 6`) + `Icon Close size 12 color="fgMuted"` | `--fill`=hairlineAlt(rgba112,115,124,.08 동일). |
| 53 | `extra` 있으면 `<div marginTop 14>` | `extra &&` `View marginTop spacing[14]` | InviteCodeCard compact 슬롯(developer가 솔로일 때만 전달). |
| 56 | 버튼 행 `display flex; borderTop 1px solid var(--line-alt)` | `actions` `flexDirection row; borderTopWidth hairline; borderTopColor color.hairlineAlt` | `--line-alt`=hairlineAlt. |
| 57 | 취소 `flex 1; padding 14; font 600 16px/1; color var(--mk-ink2)` | 취소 `Pressable`(flex1, paddingVertical 14, center) + `Text variant="dialogInput" color="fgWeak"` | `--mk-ink2`=fgWeak. 취소=입력과 동일 600/16. |
| 58 | 중앙 divider `width 1; background var(--line-alt)` | `View width 1; bg color.hairlineAlt` | 1px 세로선. |
| 59 | 저장 `flex 1; padding 14; font 800 16px/1; color var(--mk-accent-strong)` | 저장 `Pressable`(flex1, paddingVertical 14, center) + `Text variant="button"(16 Bold) color="accentStrong"` | `--mk-accent-strong`=accentStrong. 저장=button 토큰 재사용. |
| — (킷 없음) | — | **RN 확장**: `saving`→저장 `ActivityIndicator`(accentStrong)+비활성, `error`→입력 하단 인라인(`caption`/error색/center), `saveDisabled`→저장 비활성(opacity .45) | 서버 검증/진행 표시(§2 근사 사유). |

---

## 2. 웹→RN 번역 근사 사유 (RN 제약)

| # | 킷 | RN 근사 | 사유 |
|---|----|---------|------|
| A1 | 딤 `background rgba(20,12,8,.34)` | `color.fg(#2A2422 웜잉크)` + `opacity 0.34` | 토큰에 (20,12,8) 동일 색 없음. 웜 잉크 위 투명도로 근사(공용 `Sheet`와 동일 패턴, 톤 일관). |
| A2 | `paddingTop: ESP + 70` (상태바 패드 + 70) | `paddingTop = insets.top + 70` | 킷 `MK_STATUS_PAD`↔RN `useSafeAreaInsets().top`. 노치/다이나믹아일랜드 보전. 70은 컨트롤 외부 오프셋 상수(키보드 미가림 — 킷 의도). |
| A3 | `boxShadow 0 20px 50px rgba(0,0,0,.28)` | `shadow.dialog`(opacity .28, radius 50, offset h20, elevation 24) | RN `shadowRadius`는 CSS blur(50)와 1:1 아님 → 근사. 검정 그림자(컬러 아님, 킷 동일). |
| A4 | `animation mkPop/mkFade`(팝·페이드 키프레임) | `Modal animationType="fade"` | RN Modal 기본 페이드. 카드 pop(scale) 키프레임은 생략(과한 의존성 회피, 비주얼 영향 미미). 필요 시 후속 `Animated` 보강 가능. |
| A5 | `backdrop-filter`/blur | 없음 | 킷 RenameDialog 자체엔 blur 없음(딤만). 추가 근사 불필요. |
| A6 | `onKeyDown(Enter→save)` | `TextInput onSubmitEditing` + `returnKeyType="done"` | 물리 키보드 Enter↔소프트키보드 done 동등 매핑. |
| A7 | **error 슬롯(킷 없음)** | 입력 하단 `Text variant="caption" color="error"` center | 킷은 웹 검증 UX(브라우저)·서버 미표시. RN은 서버 검증(닉네임/NAME_TOO_LONG) 인라인 표시 필요(plan AC2.4·AC3.6). 킷 레이아웃 비파괴 위치(입력↔extra 사이). |
| A8 | 입력 컨테이너 `marginTop 15`·컨테이너 padding `2px 4px 2px 14px`(상/하 2·우 4·좌 14)·입력 padding `11px 0` | 동일 raw 상수(`DIALOG_LAYOUT`: `containerPaddingVertical 2`/`inputPaddingLeft 14`/`inputPaddingRight 4`/`inputMarginTop 15`/`inputPaddingVertical 11`) | 4px 그리드 밖 컨트롤 내부 수치 → 토큰화 안 함(`Button.BUTTON_SIZE` 선례). 킷 verbatim 유지(컨테이너 수직 2px 포함, V-1 반영). |

---

## 3. 토큰 변경 목록 (`src/theme/tokens.ts`)

킷 근거로 추가(라이트/다크 패리티 — `shadow`·`typography`는 두 테마 공유 객체라 단일 추가로 미러 자동 유지).

| 종류 | 토큰 | 값 | 킷 출처 |
|------|------|----|---------|
| shadow | `dialog` | `{opacity .28, radius 50, offset h20, elevation 24}` | mk-extra:37 `0 20px 50px rgba(0,0,0,.28)` |
| typography | `dialogTitle` | 17.5 / ×1.3 / Pretendard-Bold (800) | mk-extra:40 제목 |
| typography | `dialogSubtitle` | 12.5 / ×1.5 / Pretendard-Medium (500) | mk-extra:41 보조문 |
| typography | `dialogInput` | 16 / ×1.2 / Pretendard-SemiBold (600) | mk-extra:46(입력)·57(취소) |

> 저장(800/16)은 신규 토큰 없이 기존 `button`(16 Bold) 재사용. 누락/중복 토큰 0.
> 기존 재사용 토큰: `radius.sheet`(20), `radius.lg`(12), `color.primary/surface/bg/fg/fgWeak/fgMuted/accentStrong/error/hairlineAlt`, `spacing[6/8/14/16/18/20]`.

---

## 4. props 계약 (developer 인계) — `RenameDialogProps`

`@/components`에서 `RenameDialog`, `RenameDialogProps` export 완료. **프리젠테이션 전담**(검증·정규화·RPC·draft 소유 없음).

```ts
type RenameDialogProps = {
  open: boolean;                      // 표시 여부(false=미렌더)
  title: string;                      // 제목(중앙, dialogTitle). "로그 이름" · "닉네임"
  subtitle?: string;                  // 보조문(중앙, dialogSubtitle, fgMuted)
  value: string;                      // 입력 현재값(controlled, 부모 소유)
  onChange: (next: string) => void;   // 입력 변경(X 클리어 시 onChange(''))
  onCancel: () => void;               // 취소/딤 탭/뒤로(Modal onRequestClose)
  onSave: () => void;                 // 저장 탭/Enter(saving·saveDisabled면 미호출)
  placeholder?: string;               // 입력 placeholder(로그명=폴백명, 닉네임="닉네임을 입력하세요")
  maxLength?: number;                 // 입력 차단 길이(기본 20)
  extra?: React.ReactNode;            // 입력 하단 슬롯(로그명+솔로일 때만 <InviteCodeCard code compact/>)
  saving?: boolean;                   // 저장 진행(저장 버튼 로딩+비활성, 기본 false)
  error?: string | null;             // 인라인 에러(서버 검증 등, 없으면 미노출)
  saveDisabled?: boolean;             // 저장 비활성(닉네임 !canSave 등, 기본 false)
};
```

**developer 배선 가이드(plan §5·§6):**
- **부모가 draft 소유**: open 시 현재값으로 초기화(로그명 `room.name ?? ''`, 닉네임 현재 닉네임), 닫힐 때 폐기/재동기화. `value`/`onChange`로 controlled 연결.
- **로그명(LogScreen, T2)**: `title="로그 이름"`, `subtitle="비워두면 기본 이름으로 돌아가요"`(💡 제거, plan D-7), `placeholder=displayLogName({name:null,...})`, `onSave`→`renameRoom({roomId, name: draft})`, 성공 시 close+`refresh()`. **`extra`는 `memberCount<2`(솔로)일 때만** `<InviteCodeCard code={room.inviteCode} compact />`(plan D-2/AC2.5), 커플은 `undefined`. 로그명은 빈값 허용 → `saveDisabled` 미사용. 실패 시 `error=useRenameRoom.error`.
- **닉네임(ProfileScreen, T3)**: `title="닉네임"`, `value=draft`, `saveDisabled={!canSave}`, `error={nicknameMessage}`, `maxLength=20`, `extra` 미전달. `onSave`→`saveNickname({nickname: draft})`.
- 저장 로딩은 `saving={useRenameRoom.saving / useUpdateProfile.saving}` 전달.

---

## 5. 비주얼 충실도 체크리스트 (qa-visual 대조용 — 킷 mk-extra:24-64)

- [ ] **딤**: 화면 전체 웜 잉크 반투명(opacity .34), 탭 시 닫힘 (킷:30-34).
- [ ] **배치**: 카드가 상단~중앙(`insets.top+70`)에 떠 키보드 미가림 (킷:32, A2).
- [ ] **카드**: width 84%·maxWidth 320·radius 20·surface 배경·큰 그림자(shadow.dialog) (킷:35-37).
- [ ] **제목**: 800/17.5 fg 중앙(dialogTitle) (킷:40).
- [ ] **보조문**: 500/12.5 fgMuted 중앙, 제목 아래 6px(subtitle 전달 시) (킷:41).
- [ ] **입력 행**: 1.5px accent(primary) 보더·radius 12·bg(흰)·marginTop 15·gap 8 (킷:42).
- [ ] **입력 텍스트**: 600/16 fg, paddingVertical 11 (킷:46).
- [ ] **X 클리어**: value 있을 때만, 24×24 원형 fill(hairlineAlt) + close 12 fgMuted, marginRight 6 (킷:47-51).
- [ ] **extra**: 입력 하단 14px, InviteCodeCard compact(솔로 로그명만) (킷:53).
- [ ] **버튼 행**: 상단 hairline divider + 취소(600/16 fgWeak) │ 1px divider │ 저장(800/16 accentStrong), 좌우 균등 분할, padding 14 (킷:56-59).
- [ ] **상태(RN 확장)**: saving→저장 스피너+비활성, error→입력 하단 인라인(error색), saveDisabled→저장 흐림 (A7).
- [ ] **헤더 진입 불변(델타#9)**: `LogTitleButton`(아바타+로그명 700/16+pencil 15) 비주얼 그대로, 진입만 Sheet→Dialog (plan §4.3, qa-visual §5). ← developer 재배선, 본 프리미티브 범위 밖.
- [ ] **safe-area/다크**: `insets.top` 보전, 다크 테마 토큰 자동 미러(surface/fg/primary 등).

---

## 6. 생성/수정 파일

| 파일 | 변경 | 비고 |
|------|------|------|
| `src/components/RenameDialog.tsx` | **신설** | 공용 프리미티브(§1·§4). |
| `src/components/RenameDialog.spec.tsx` | **신설** | 프리젠테이션 단위 17 케이스(AC1.1~1.8 전수). |
| `src/components/index.ts` | 수정 | `RenameDialog`/`RenameDialogProps` export 추가. |
| `src/theme/tokens.ts` | 수정 | `shadow.dialog` + typography `dialogTitle`/`dialogSubtitle`/`dialogInput` 추가(§3). |

**검증:** `npx jest src/components/RenameDialog.spec.tsx` 17/17 ✅ · 전체 `npx jest` 945/945 ✅(회귀 0) · `npx tsc --noEmit` exit 0 ✅.

---

## 7. 경계(미수행 — developer)

- `LogScreen`/`ProfileScreen` RenameDialog 재배선·draft 소유·초대코드 솔로 게이팅(T2·T3).
- `LogNameSheet.tsx`/`.spec.tsx` 삭제·배럴 export 제거·`LogScreen.spec` 더블 갱신(T4).
- `LogTitleButton` 재배선(onEdit→Dialog open) — 비주얼 불변(본 스프린트 변경 없음).
