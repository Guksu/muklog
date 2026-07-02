# QA Report — Visual (app-version-gate)

> 담당: qa-visual. 범위: 신설 UI 3종(ForceUpdateScreen·UpdateSuggestModal·AppVersionRow)의 비주얼 충실도만. 데이터·Linking·BackHandler·게이트 배선은 qa-logic 담당 — 제외.
> **킷 비종속 신설** — `templates/muklog`에 버전 게이트 시안 없음. 대조 기준 = ui-spec.md §0의 프리미티브·토큰 파일:라인 근거(room-lifecycle 배너 선례와 동일 방식).
> 검증일: 2026-07-03.

## 판정: 통과 — 비주얼 이슈 0건 (근사 허용 1건 · 미검증 2건: developer 삽입 대기 + 디바이스 스모크)

토큰 준수(raw hex 0)·브랜드 규칙(코럴=AppMark 한정, CTA=블루)·카피 보이스(해요체)·RenameDialog 셸 동기 복제 정확성 모두 정합. 셸 drift 0. 테스트 12/12 green. ui-publisher 라우팅 필요 이슈 없음.

---

## 1. ForceUpdateScreen (T8) — 브랜드 규칙·카피·분기

파일: `src/features/appVersion/ForceUpdateScreen/ForceUpdateScreen.tsx`

| 축 | ui-spec 근거 | RN 실값 | 판정 |
|----|----|----|----|
| 셸 | Screen center (Screen.tsx:18) | L28 `<Screen center>` | ✅ |
| 콘텐츠 블록 | width 100%·maxWidth 320·center | L29·72 `width:'100%'`·maxWidth 320·alignItems center | ✅ |
| 브랜드 마크 | AppMark size 72 (코럴 캐리어) | L30 `<AppMark size={72}>` | ✅ |
| 제목 | emptyTitle/fg center, marginTop spacing[20] | L31-37 정합 | ✅ |
| 본문 | body/fgWeak center, marginTop spacing[10] | L38-45 정합 | ✅ |
| CTA(storeUrl 有) | Button primary lg full, marginTop spacing[28] | L46-55 정합 | ✅ |
| CTA(storeUrl null) | 버튼 숨김 + 안내문 bodySm/fgMuted, marginTop spacing[28] | L56-64 정합 | ✅ |

**브랜드 규칙(중요):** 코럴은 AppMark(브랜드 「먹 핀」 마크)로만 캐리, CTA는 인앱 블루 primary Button. tokens.ts:28-31·94-97(accentShadow 블루=인앱 primary 전용 / brandShadow·brandMarkGlyph 코럴=마크 한정)과 정합. **브랜드 규칙 위반 0.** raw hex 0(전 색 토큰 경유: fg·fgWeak·fgMuted, 코럴은 AppMark 내부 brandGradient/brandMarkGlyph 토큰).

**카피 보이스(해요체·사용자 주어·이득 먼저):**
- 제목 "업데이트가 필요해요" ✅ 해요체
- 본문 "먹로그를 계속 사용하려면\n최신 버전으로 업데이트해 주세요." ✅ 이득(계속 사용) 먼저·해요체
- null 안내문 "앱스토어에서 먹로그를 최신 버전으로\n업데이트해 주세요." ✅ 해요체

---

## 2. UpdateSuggestModal (T9) — RenameDialog 셸 동기 복제 diff (핵심)

파일: `UpdateSuggestModal/UpdateSuggestModal.tsx` ↔ 원본 `src/components/RenameDialog/RenameDialog.tsx`

**셸 값 전수 대조 (복제 drift 검출):**

| 셸 값 | RenameDialog | UpdateSuggestModal | 판정 |
|----|----|----|----|
| Modal | transparent·animationType="none" (L127) | L53 동일 | ✅ |
| 딤 opacity | 0.34·bg fg (L30·134) | L17·60 동일 | ✅ |
| 카드 width/maxWidth | 84% / 320 (L36-37) | L21-22·47 동일 | ✅ |
| 카드 radius/bg | radius.sheet / surface (L149-151) | L48-49 동일 | ✅ |
| 카드 shadow | shadow.dialog (L152) | L68 동일 | ✅ |
| body padding | top spacing[20]·H spacing[18]·bottom spacing[16] (L159-162) | L74-76 동일 | ✅ |
| 제목 | dialogTitle/fg center (L165) | L80 동일 | ✅ |
| 본문 | dialogSubtitle/fgMuted marginTop spacing[6] (L169-172) | L83-86 동일 | ✅ |
| 버튼 행 borderTop | hairlineWidth·hairlineAlt (L277·220) | L147·94 동일 | ✅ |
| 버튼 padding | buttonPadding 14 (L46·278) | L23·148 동일 | ✅ |
| divider | width 1·hairlineAlt (L47·232·280) | L24·106·149 동일 | ✅ |
| pressed | opacity 0.6 (L281) | L150 동일 | ✅ |
| 버튼 라벨 색 | 취소 dialogInput/fgWeak·저장 button/accentStrong (L228·249) | 나중에 dialogInput/fgWeak·업데이트 button/accentStrong (L102·114) | ✅ |

**셸 drift 0** — RenameDialog와 완전 동기.

**근거 있는 divergence 1건(근사 허용):** RenameDialog는 키보드 회피용 `topOffset 70`(상단~중앙, RenameDialog.tsx:34·138·264)이나, 본 모달은 입력이 없어 **수직 정중앙**(`wrap: justifyContent center`, L143). → 확인형 다이얼로그 표준 위치. ui-spec §54 + 컴포넌트 주석(L8)에 사유 기록 → **근사 허용**.

**미재현/근사(RenameDialog 계승):** backdrop blur·컬러 그림자 미지원 → 반투명 딤 + shadow.dialog(검정) 근사, animationType="none"(잔상 회피). RenameDialog.tsx:6-10 주석과 동일 사유 → 라이트/다크 디바이스 스모크로만 최종 확인.

**카피:** 제목 "새 버전이 나왔어요"(해요체) · 본문 "더 좋아진 먹로그를 만나보세요.\n지금 업데이트할까요?"(이득 먼저·해요체) · 버튼 "나중에/업데이트/확인" ✅. raw hex 0.

---

## 3. AppVersionRow (T10) — placement·톤

파일: `AppVersionRow/AppVersionRow.tsx`

- 톤: `View` 비-pressable + `Text caption/fgMuted` "앱 버전 {version}" (L15-20) — ui-spec §82 정합. 언더라인 없음(비-액션) ✅. raw hex 0.
- 위계: 로그아웃(카드·error) > 회원탈퇴(caption/fgMuted, ProfileScreen.tsx:359 언더라인 톤) > 앱 버전(plain caption) — ui-spec §83 의도 정합 ✅.

**⚠ placement 미검증 (developer 삽입 대기):** ProfileScreen(`src/navigation/screens/ProfileScreen/ProfileScreen.tsx`)에 **AppVersionRow가 아직 삽입되지 않음**(grep 결과 import·사용 0). 회원탈퇴 행(L353-362) 아래 삽입은 developer T14(구현: 게이트 배선, in_progress) 몫 → **삽입 위치·간격 정합은 developer 삽입 후 디바이스 스모크로만 검증 가능**(현재 컴포넌트 자체는 정합, placement은 통과 처리 아님).

**관찰(경미):** AppVersionRow `paddingVertical 12`(L25)는 위쪽 행 리듬(signOutRow·deleteRow 모두 `paddingVertical 16`, ProfileScreen.tsx:423·426)보다 tight. ui-spec §82가 12를 명시했고 최하위 위계 행이라 의도적으로 볼 수 있으나, 삽입 후 실제 행 간 리듬이 어색하지 않은지 디바이스 스모크에서 확인 권장(치명 아님, ui-publisher 판단 시 16 정렬 고려 가능).

---

## 4. 토큰 준수 (raw hex 0)

3개 컴포넌트 전수 grep 결과 **raw hex 0건**. 전 색 토큰 경유: `fg·fgWeak·fgMuted·surface·hairlineAlt·accentStrong` + Button primary(내부 `#3366FF`·accentShadow) + AppMark 코럴(내부 `brandGradient·brandMarkGlyph`). radius `radius.sheet(20)`·Button `radius.control`, spacing `6/10/16/18/20/28`, shadow `shadow.dialog`·`accentShadow`. 신규 하드코딩 색 0.

---

## 5. 테스트 계약 강도 + 스모크 항목 평가

**단위(green):** ForceUpdateScreen·UpdateSuggestModal·AppVersionRow spec **12/12 green**(직접 실행 확인).
- 커버: 렌더·testID·콜백·storeUrl 분기(버튼 vs 안내문/단일 확인)·visible 토글.
- **한계(중요):** 스펙은 **행동·분기만 고정**하고 **셸 비주얼 값(딤 0.34·카드 radius·hairline·shadow·정중앙)은 단언 안 함**(RN 단위 스타일 단언은 취약 → 미검증). 즉 RenameDialog 셸 drift는 단위로 안 잡힘 → **본 리포트 §2 수동 대조 + 디바이스 스모크가 유일한 방어선**. 이번 수동 대조에서 drift 0 확인.

**디바이스 스모크 필수(단위로 안 드러남 — 통과 처리 아님):** ui-spec §5 스모크 체크리스트 충분성 = **충분**(전면 차단·백버튼 no-op·Linking·딤 톤·placement·라이트/다크 커버). 그대로 채택:
- [ ] ForceUpdateScreen 전면 덮음·우회 불가 / Android 하드웨어백 no-op(developer BackHandler 후)
- [ ] storeUrl 有→버튼 Linking 오픈 / null→안내문만
- [ ] UpdateSuggestModal 딤·중앙 카드·2버튼 행이 RenameDialog와 **동일 톤**(딤 농도·radius·hairline)으로 렌더 + 정중앙 위치
- [ ] Profile 최하단 "앱 버전 x.y.z"가 회원탈퇴 아래 약톤(developer 삽입 후 — placement·행 리듬 §3 관찰 포함)
- [ ] **라이트/다크** 토큰 미러(코럴 마크·딤·텍스트 대비) — 모달 딤·AppMark 코럴은 다크에서 육안 확인 필수

---

## 6. ui-publisher 라우팅 / 미검증

- **불일치·수정요청 없음.** 3종 모두 ui-spec §0 프리미티브·토큰 근거와 정합, 브랜드 규칙·카피·raw hex·셸 복제 모두 통과.
- **미검증(사유):**
  1. AppVersionRow의 ProfileScreen 실삽입 placement·행 리듬 → developer T14 삽입 대기 + 디바이스 스모크(통과 처리 아님).
  2. 모달 딤/카드/코럴 마크 렌더 픽셀·라이트/다크 미러 → 단위 불가, 디바이스 스모크 필수(§5).
- **경미 관찰(치명 아님):** AppVersionRow paddingVertical 12 vs 위쪽 행 16 — 삽입 후 리듬 확인 권장.
