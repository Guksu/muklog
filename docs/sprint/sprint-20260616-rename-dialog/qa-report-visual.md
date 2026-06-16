# QA Report — Visual (rename-dialog)

> 검증: qa-visual · 날짜: 2026-06-16 · 슬러그 `sprint-20260616-rename-dialog`
> 단일 출처(SSOT): 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx` `RenameDialog`(24-64) · 사용처 `mk-log.jsx:126-130`(로그명)·`556-558`(닉네임)
> 대상: `src/components/RenameDialog.tsx` · `src/theme/tokens.ts`(diff) · `LogScreen.tsx`·`ProfileScreen.tsx`(배선) · `LogTitleButton.tsx` · `ui-spec.md`
> 방법: 킷 JSX ↔ RN 컴포넌트 동시 대조(3축: 레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피) + 토큰 원천 실값 추적 + raw hex 전수 grep

## 요약 (2차 — 통합 재검증 완료)

| 분류 | 건수 |
|------|------|
| ✅ PASS | 16 (프리미티브 12 + 배선 4) |
| ⚠️ 불일치(FAIL) | **0** (V-1 해소) |
| 🟦 근사 허용(ui-spec 사유 대조 통과) | 7 (A1~A4, A6~A8) |
| 📌 의도된 기획 분기(plan 문서화·킷 카피/동작 오버라이드) | 2 (subtitle·extra 솔로게이팅) |

**판정: ✅ 비주얼 완료(PASS).** 1차 V-1(입력 컨테이너 수직 패딩) 수정 반영 확인. PENDING 4건(LogScreen 로그명·ProfileScreen 닉네임·LogNameSheet 폐기·LogTitleButton 불변) 모두 킷 정합 통과. raw hex/rgb 0건, 신규 토큰 4종 킷 실값 정합.

> **1차 이력(보존):** PASS 12 / FAIL 1(V-1 경미) / 근사 7 / PENDING 4 → 조건부 통과. 아래 §V-1·§PENDING에 2차 결과 반영.

---

## ✅ V-1 해소 (2차 재검증)

**V-1 (입력 컨테이너 수직 패딩 2px 누락) → 수정 확인.**
- `RenameDialog.tsx:33-47` `DIALOG_LAYOUT`에 `containerPaddingVertical: 2`(킷 mk-extra:42 "2px ...") 추가.
- `RenameDialog.tsx:105-114` `inputRow`에 `paddingVertical: DIALOG_LAYOUT.containerPaddingVertical` 적용 → 킷 컨테이너 상/하 2px verbatim 복원. ✅ ui-publisher-2 수정 반영 완료.

---

## (1차) ⚠️ 불일치 — 1건 [해소됨, 이력 보존]

### V-1 (경미/Low) 입력 컨테이너 수직 패딩 2px 누락

- **킷** `mk-extra.jsx:42`: 입력 컨테이너 `padding: "2px 4px 2px 14px"` → 상/하 **2px**, 우 4px, 좌 14px.
- **RN** `RenameDialog.tsx:104-112` `inputRow`: `paddingLeft 14`(:109) · `paddingRight 4`(:110)만 설정. **`paddingVertical: 2` 누락**.
- **ui-spec 매핑 누락 동반**: `ui-spec.md:39`도 킷 `2px 4px 2px 14px`를 "paddingLeft 14/paddingRight 4"로만 옮겨 상/하 2px이 번역 단계에서 탈락. (A8 raw 상수 목록에도 `11/14/4`만 있고 수직 2는 없음.)
- **효과**: 입력 행 가시 높이가 킷 대비 상·하 각 2px(총 4px) 작음. 입력 텍스트/X버튼이 1.5px accent 보더에 약간 더 붙음. 비주얼 영향 작으나 킷 verbatim 이탈.
- **수정 제안**: `inputRow`(:104-112)에 `paddingVertical: 2` 추가(킷 컨트롤 내부 raw 상수 → `DIALOG_LAYOUT`에 `inputPaddingVerticalOuter: 2` 추가 권장, 선례 정합). 동시에 `ui-spec.md:39`·§2 A8에 수직 2px 명기.

---

## ✅ PASS (12)

킷 라인 ↔ RN 파일:라인 대조 결과 정합.

| # | 항목 | 킷 | RN | 결과 |
|---|------|----|----|------|
| P-1 | 미렌더 게이트 | `:25` `if(!open) return null` | `:96` 동일 | ✅ |
| P-2 | 딤 오버레이 + 탭 닫기 | `:30-34` inset0·flex·center·flex-start·ESP+70·딤 | `:126-132` `backdrop` absoluteFill Pressable onPress=onCancel + `:134-136` wrap flex1·alignItems center·paddingTop `insets.top+70`·box-none | ✅ (z-순서: backdrop→wrap 위, 카드 노출 정상) |
| P-3 | 카드 | `:35-37` width84%·maxW320·`--mk-card`·radius20·overflow hidden·shadow | `:139-150,262` width `'84%'`·maxWidth 320·`surface`·`radius.sheet`(20)·overflow hidden·`shadow.dialog` | ✅ (radius=sheet 20, **card 22 아님** — 킷 `borderRadius:20` 정합) |
| P-4 | 카드 탭 미닫힘 | `:35` stopPropagation | `:139-141` 카드 Pressable onPress `()=>{}` 별도 레이어 | ✅ |
| P-5 | 본문 패딩 | `:39` `20px 18px 16px` | `:156-158` `spacing[20]/[18]/[16]` | ✅ |
| P-6 | 제목 | `:40` 800/17.5·`--mk-ink`·center | `:162-164` `dialogTitle`(17.5/1.3 Bold)·`fg`·center | ✅ |
| P-7 | 보조문 | `:41` 500/12.5·`--text-alternative`·center·margin 6 0 0 | `:165-173` `dialogSubtitle`(12.5/1.5 Medium)·`fgMuted`·center·marginTop `spacing[6]` | ✅ |
| P-8 | 입력 텍스트 | `:46` 600/16·`--mk-ink`·padding 11 0 | `:113-117,188` `dialogInput`(16/1.2 SemiBold)·`fg`·paddingVertical 11 | ✅ |
| P-9 | X 클리어 | `:47-51` value시·`--fill`·24×24·radius999·marginR6 + close12 `--text-alternative` | `:190-200,267-273` value시·`hairlineAlt`·24×24·radius `clearSize/2=12`(=원형)·marginRight 6 + Icon Close 12 `fgMuted` | ✅ |
| P-10 | extra 슬롯 | `:53` marginTop14 | `:213` `marginTop spacing[14]` | ✅ |
| P-11 | 버튼 행 분할 | `:56-59` borderTop1px `--line-alt` + 취소(600/16 `--mk-ink2`) │ 1px `--line-alt` │ 저장(800/16 `--mk-accent-strong`)·flex1·padding14 | `:217-251,274-277` borderTop hairline `hairlineAlt` + 취소 `dialogInput`/`fgWeak` │ width1 `hairlineAlt` │ 저장 `button`/`accentStrong`·flex1·paddingVertical14 | ✅ |
| P-12 | 상태(RN 확장) | — | `:243-244` saving→`ActivityIndicator` accentStrong+disabled · `:203-211` error→`caption`/`error`/center · `:276` saveDisabled→opacity .45 | ✅ (A7) |

### 토큰 정합 (raw hex/rgb 0건)
- `grep -rnE "#[0-9a-fA-F]{3,6}" / "rgba?\("` on `RenameDialog.tsx` → **코드 0건**(주석 2건만, :7·:29 근사 사유 설명). ✅
- 신규 토큰 4종 킷 실값 정합(`tokens.ts` diff 대조):
  - `shadow.dialog` `{opacity .28, radius 50, offset h20, elevation 24}` = 킷 `:37` `0 20px 50px rgba(0,0,0,.28)` ✅ (검정 그림자, 컬러 아님)
  - `typography.dialogTitle` 17.5/×1.3/Pretendard-Bold = 킷 `:40` 800/17.5/1.3 ✅
  - `typography.dialogSubtitle` 12.5/×1.5/Pretendard-Medium = 킷 `:41` 500/12.5/1.5 ✅
  - `typography.dialogInput` 16/×1.2/Pretendard-SemiBold = 킷 `:46,57` 600/16 ✅
- 폰트 웨이트 매핑: 킷 800(제목·저장)→Pretendard-Bold는 **프로젝트 전역 컨벤션**(inviteCode/profileName/ratingNum 동일 — ExtraBold 미등록). 일관 ✅
- 색 토큰 원천 추적 검증: `--mk-accent`(#3366FF)=primary · `--mk-accent-strong`(#1F4FE0)=accentStrong · `--mk-card/bg`(#FFF)=surface/bg · `--mk-ink`(#2A2422)=fg · `--mk-ink2`(#5C5550)=fgWeak. **`--fill`=`--fill-normal`=rgba(112,115,124,.08) · `--line-alt`=`--line-normal-alternative`=rgba(112,115,124,.08)** → 둘 다 RN `hairlineAlt`(동일 값) **정합 검증 완료**(figma-variables.css:141·253). ✅

---

## 🟦 근사 허용 (ui-spec §2 사유 대조 통과 — 7건)

| # | 킷 | RN 근사 | 판정 |
|---|----|---------|------|
| A1 | 딤 `rgba(20,12,8,.34)` | `color.fg`(웜 잉크 #2A2422)+opacity 0.34 | ✅ 허용 — 토큰 동일 색 부재. **공용 `Sheet`(.32)와 동일 패턴**(Sheet.tsx:17,47), RenameDialog는 킷대로 .34 충실. |
| A2 | `paddingTop ESP+70` | `insets.top + 70` | ✅ 허용 — `MK_STATUS_PAD`↔`useSafeAreaInsets().top`. 70은 컨트롤 외부 상수(키보드 미가림 의도). |
| A3 | `boxShadow 0 20px 50px rgba(0,0,0,.28)` | `shadow.dialog` | ✅ 허용 — RN shadowRadius↔CSS blur 1:1 아님. 검정(컬러 아님). |
| A4 | `mkPop/mkFade` 키프레임 | `Modal animationType="fade"`(pop 생략) | ✅ 허용 — 비주얼 영향 미미. 후속 Animated 보강 가능. |
| A6 | `onKeyDown(Enter→save)` | `onSubmitEditing`+`returnKeyType="done"` | ✅ 허용 — 동등 매핑(`:182,187`). |
| A7 | error 슬롯(킷 없음) | 입력 하단 `caption`/`error`/center(`:203-211`) | ✅ 허용 — 서버 검증 표시(plan AC2.4·AC3.6). 킷 레이아웃 비파괴 위치(입력↔extra 사이). |
| A8 | `marginTop15`·`padding 11/14/4` | raw 상수 `DIALOG_LAYOUT` | ✅ 허용 — 4px 그리드 밖 컨트롤 내부 수치(Button 선례). ※ 단 **수직 2px은 누락 → V-1 참조**. |

> Android `statusBarTranslucent` 미설정으로 딤이 상태바 영역 비커버 가능성 — **공용 Sheet도 동일**(프로젝트 컨벤션), 본 스프린트 회귀 아님. 별도 이슈로 분리(비차단).

---

## ✅ 배선 통합 재검증 (구 PENDING 4건 — 전부 PASS)

킷 사용처(`mk-log.jsx:126-130`·`556-558`) ↔ RN 배선 동시 대조.

### D-1 · LogScreen 로그명 다이얼로그 — ✅ PASS
- `LogScreen.tsx:525-537` `<RenameDialog open title="로그 이름" value={nameDraft} placeholder={fallbackName} saving error .../>`.
- `title="로그 이름"` = 킷 mk-log:126 ✓ · `placeholder=fallbackName`(displayLogName name:null) ↔ 킷 `placeholder={defaultTitle}` ✓ · maxLength 미전달→기본 20 ↔ 킷 maxLength={20} ✓.
- 진입: `LogTitleButton onEdit={handleOpenNameEdit}`(:475) → `editOpen`(:526). draft 부모 소유·재오픈 현재값 재동기화 ✓.
- 📌 **subtitle**: RN `"비워두면 기본 이름으로 돌아가요"`(:528) ↔ 킷 `"우리만의 이름을 지어보세요"`. **plan D-7(💡 제거·카피 변경) 의도적 킷 오버라이드**(ui-spec §4·team-lead 확정) — FAIL 아님.
- 📌 **extra 솔로 게이팅**: RN `extra={isCouple ? undefined : <InviteCodeCard code compact/>}`(:536) ↔ 킷은 무조건 노출(mk-log:130). **plan D-2/AC2.5(솔로 memberCount<2만·커플 미노출) 의도적 분기** — FAIL 아님. 슬롯 위치(입력 하단 marginTop14)는 프리미티브 P-10 정합.

### D-2 · ProfileScreen 닉네임 다이얼로그 — ✅ PASS
- `ProfileScreen.tsx:281-293` `<RenameDialog open title="닉네임" value={draft} saving saveDisabled error .../>`.
- `title="닉네임"` = 킷 mk-log:556 ✓ · **extra 미전달**(초대코드 미동봉, AC3.7) = 킷 mk-log:556-558 extra 없음 ✓ · `saveDisabled={!canSave}`·`error={nicknameMessage}`·`saving={savingNickname}` 정상 배선 ✓ (프리미티브 P-12 비주얼).
- 진입: 인라인 닉네임 펜슬(:186) → `nickDialogOpen`. open 시 현재 닉네임 prefill(:67-68) ✓.
- 📌 **placeholder** `"닉네임을 입력하세요"`(:288) ↔ 킷 `placeholder={me.nickname}` — ui-spec §4 의도 카피(value가 현재닉 prefill이라 평시 미노출). FAIL 아님.
- ⓘ **qa-logic 교차참조(비주얼 무관)**: RN `maxLength=NICKNAME_MAX_LENGTH(20)` ↔ 킷 mk-log:557 `maxLength={12}`. 검증 규칙 차이 → **로직 영역(qa-logic)**, 비주얼 렌더 영향 없음.

### D-3 · LogNameSheet 폐기 잔차 — ✅ PASS
- `LogNameSheet.tsx`·`.spec.tsx` 삭제(git D) · `grep "LogNameSheet" src/` **0건** · `src/features/room/index.ts` export 제거.
- 헤더 진입이 `LogTitleButton`→`RenameDialog` 단일 경로로 일원화, 구 시트 비주얼 잔차 0 ✓.

### D-4 · LogTitleButton 비주얼 불변 — ✅ PASS
- `LogTitleButton.tsx` **git clean(이번 스프린트 변경 0)** → 비주얼 불변 보장.
- 렌더 구성 유지: avatarSlot + 로그명 `navTitle`(700/16 Bold, tokens:183) fg + `Pencil` size 15 `fgAssistive`(킷 mk-log:40), flex row·gap spacing[8]·marginLeft 2·paddingVertical 4(킷 mk-log:32). 진입만 Sheet→Dialog(`onEdit`) 전환, 비주얼 동일 ✓.

---

## 후속

- ✅ V-1 수정 + 배선 4건 모두 통과 → **비주얼 충실도 완료(PASS)**.
- ⓘ qa-logic: 닉네임 `maxLength` 킷12↔RN20 검증규칙 차이는 로직 영역으로 이관(비주얼 무관).
- 비주얼 잔여 FAIL 0건.
