# UI Spec — log-name (로그 이름)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx` (헤더 32-41, 편집 시트 91-102).
> 퍼블리셔 산출물: 프리젠테이션 컴포넌트 2종 + pencil 아이콘 글리프. **데이터/검증/RPC/네비 배선은 developer 몫**(이 문서 §4 조립 가이드 참조).
> 완료: 관련 `npm test` 19개 green. `npm run typecheck`는 이 환경에서 실행 차단되어 **사용자/Developer가 최종 게이트로 1회 실행**(신규 코드는 기존 타입 API만 사용 — Sheet/Button/Icon/TextInput/useTheme).

---

## 1. 산출물 목록

| 파일 | 종류 | 비고 |
|---|---|---|
| `src/features/room/components/LogNameSheet.tsx` | 신규 컴포넌트 | 이름 편집 시트(킷 mk-log:91-102). 공용 `Sheet` 재사용. |
| `src/features/room/components/LogNameSheet.spec.tsx` | 신규 테스트 | 8 케이스(초기값·placeholder·maxLength·저장 콜백 원문·saving 비활성·error). |
| `src/features/room/components/LogTitleButton.tsx` | 신규 컴포넌트 | 헤더 제목+✏️ 탭 버튼(킷 mk-log:32-41). LogScreen headerMain 슬롯 대체용. |
| `src/features/room/components/LogTitleButton.spec.tsx` | 신규 테스트 | 4 케이스(title·avatarSlot·onEdit·pencil 노출). |
| `src/components/Icon.tsx` | 수정 | `IconName.Pencil = 'pencil'` 추가. |
| `assets/icons/icons.ts` | 수정 | `pencil` 글리프(ui-design `assets/icons/pencil.svg` verbatim, width/height 제거). |
| `src/components/Icon.spec.tsx` | 수정 | pencil 렌더 케이스 1개 추가. |
| `src/features/room/index.ts` | 수정 | `LogNameSheet`·`LogTitleButton`(+타입) 배럴 export. |

**토큰 변경: 없음.** 모든 색/radius/폰트는 기존 토큰으로 충족(아래 §2 매핑). 신규 토큰/그라데이션 불필요.

---

## 2. 킷 라인 ↔ RN 매핑

### 2.1 편집 시트 — 킷 `mk-log.jsx:91-102` ↔ `LogNameSheet.tsx`

| 킷(웹) | 킷 실값 | RN 번역 | 토큰/근거 |
|---|---|---|---|
| `<SHEET2 open onClose title="로그 이름">` (91) | 상단 26 radius·핸들바·딤 rgba(20,12,8,.32) | 공용 `<Sheet visible onClose title="로그 이름">` | `Sheet.tsx`(기존, audit 정비). `open`→`visible` 매핑. |
| `<input value maxLength={20} autoFocus placeholder={defaultTitle}>` (92-93) | — | `<TextInput accessibilityLabel="로그 이름" value maxLength={20} autoFocus placeholder editable={!saving}>` | maxLength 상수 `LOG_NAME_INPUT_MAX_LENGTH=20`(C-LEN). placeholderTextColor=`fgMuted`. |
| input `border:"2px solid var(--mk-accent)"` (95) | 2px / #3366FF | `borderWidth: 2`(상수 `INPUT_BORDER_WIDTH`), `borderColor: color.primary` | 강조 포커스 보더(헤어라인 아님 — 킷 명시). primary=`#3366FF` 정합. |
| input `borderRadius:14` (95) | 14 | `borderRadius: radius.control` | control=14(=--mk-radius-btn). |
| input `padding:"14px 16px"` (95) | 14/16 | `paddingVertical:14`/`paddingHorizontal:16`(상수) | 컨트롤 내부 수치(4px 그리드 밖, 토큰화 안 함 — Button과 동일 정책). |
| input `font:"600 17px/1"` (95) | SemiBold 17, lh=size | `fontSize:17`, `fontFamily: typography.cardTitle.fontFamily`(Pretendard-Bold) | ⚠️ 킷은 600(SemiBold). 현 토큰엔 17px SemiBold family 역할 토큰이 없어 가장 가까운 `cardTitle`(17px) family를 차용 — **family는 Bold(700)로 한 단계 굵음**. 근사 사유: 17px 전용 SemiBold 역할 토큰 부재(신규 토큰 추가는 plan 범위 밖). 굵기 차이는 입력 1줄이라 시각 영향 미미. qa-visual 확인 대상. |
| input `color:var(--mk-ink)` (95) | #2A2422 | `color: color.fg` | fg=웜 잉크. |
| input `background:var(--mk-card)` (95) | 카드면(흰) | `backgroundColor: color.surface` | surface. |
| 힌트 row `gap:6 margin:"10px 4px 0"` (96) | 6 / 10·4 | `flexDirection:'row' gap:6`, `marginTop: spacing[10]`, `marginHorizontal: spacing[4]` | gap 6은 킷 실값(인라인). |
| 힌트 `💡 fontSize:13` (97) | 이모지 13 | `<Text style={{fontSize:13}}>💡</Text>`(상수 `HINT_EMOJI_SIZE`) | muklog 플레이풀 예외(이모지 허용). |
| 힌트 텍스트 `font:"500 12.5px/1.4" color:var(--text-alternative)` (98) | Medium 12.5 / 보조 | `<Text variant="sectionCaption" color="fgMuted">` | sectionCaption=14/Medium(12.5 정수 근사 — 기존 정책). text-alternative→fgMuted. 카피 "우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요." (💡 분리). |
| `<div style={{height:16}}/>` (100) | 16 spacer | `<View style={{height: spacing[16]}}/>` | 힌트↔버튼 간격. |
| `<BTN2 full size="lg" onClick={saveTitle}>저장</BTN2>` (101) | full·lg primary | `<Button title="저장" variant="primary" size="lg" full loading={saving} onPress=... accessibilityLabel="저장">` | 기존 `Button`(audit 정합). saving→loading(ActivityIndicator·opacity .45·disabled). |
| (킷에 없음 — 앱 추가) | — | error 있을 때 `<Text variant="bodySm" color="error">{error}` (버튼 위) | plan §4.2 "error inline". 서버 NAME_TOO_LONG 등 표시. |

**RN 미재현/근사 기록:**
- 입력 폰트 굵기: 킷 600(SemiBold) → 17px 전용 SemiBold 역할 토큰 부재로 `cardTitle`(700/Bold) family 차용. 사유 위 표 기재.
- 시트 상단 라운드 26: `Sheet`가 이미 26 근사(킷=26, audit 결정). 변경 없음.
- 딤 색 rgba(20,12,8,.32): `Sheet`가 `color.fg`+opacity .32로 근사(audit 결정). 변경 없음.

### 2.2 헤더 제목 버튼 — 킷 `mk-log.jsx:32-41` ↔ `LogTitleButton.tsx`

| 킷(웹) | 킷 실값 | RN 번역 | 토큰/근거 |
|---|---|---|---|
| `<button onClick={openEdit} style={{flex:1, display:flex, gap:8, marginLeft:2, padding:"4px 0"}}>` (32) | flex1·gap8·ml2·py4 | `<Pressable accessibilityRole="button" accessibilityLabel="로그 이름 편집" onPress={onEdit}>` + `flex:1, flexDirection:'row', alignItems:'center', gap: spacing[8], marginLeft:2, paddingVertical:4` | 제목 영역 전체가 탭 가능(편집 진입점, 결정3). pressed opacity .6. |
| `<div style={{display:flex}}>` + `<AV2 me/>` + `<AV2 partner ml:-9/>` (33-36) | 아바타 겹침 28, ml -9 | `avatarSlot` prop(React.ReactNode) — **LogScreen이 기존 Avatar 스택 JSX를 그대로 주입** | 아바타 데이터(avatarUrl/userId/isCouple)는 developer 영역 → 슬롯으로 분리(퍼블리셔는 레이아웃만). |
| `<span style={{font:"700 16px/1.2", color:var(--mk-ink), ellipsis, minWidth:0}}>{title}</span>` (37-39) | Bold 16 / 잉크 / 말줄임 | `<Text variant="navTitle" color="fg" numberOfLines={1} style={{flexShrink:1}}>{title}</Text>` | navTitle=16/Bold(=킷 700/16). 말줄임=numberOfLines 1 + flexShrink. |
| `<I2 name="pencil" size={15} color="var(--text-assistive)" style={{flex:none}}/>` (40) | pencil 15 / 비활성 텍스트 | `<Icon name={IconName.Pencil} size={15} color="fgAssistive"/>` | text-assistive→fgAssistive. pencil 글리프 신규(ui-design verbatim). flex:none=고정폭(Icon 기본). |

---

## 3. props 계약 (developer가 채움)

### 3.1 `LogNameSheet` — `src/features/room/components/LogNameSheet.tsx`
```ts
type LogNameSheetProps = {
  open: boolean;            // 시트 표시 여부
  initialValue: string;     // 입력 초기값 = 이름 있으면 room.name, 없으면 ''(폴백은 placeholder로)
  placeholder: string;      // = displayLogName({ name: null, memberCount, selfNickname: meNickname })
  onClose: () => void;      // 딤/요청 시 닫기
  onSave: (next: string) => void; // ⚠️ 입력 원문(draft) 그대로 전달 — 정규화 X, RPC X
  saving?: boolean;         // 저장 중 → 버튼 loading·비활성, 입력 editable=false
  error?: string | null;    // 서버 에러 메시지(mapRoomError 결과) inline 표시
};
```
- **내부 동작(퍼블리셔 책임):** draft 로컬 state, open 시 initialValue로 리셋(`useEffect syncDraftOnOpen`), maxLength 20 입력 차단, autoFocus, 저장 탭→`onSave(draft)`.
- **하지 않음(developer 책임):** trim/null 정규화, 길이 검증, `useRenameRoom` 호출, refresh, 토스트, 시트 close 타이밍(성공 시).

### 3.2 `LogTitleButton` — `src/features/room/components/LogTitleButton.tsx`
```ts
type LogTitleButtonProps = {
  title: string;                 // = displayLogName({ name: room.name, memberCount, selfNickname: meNickname })
  onEdit: () => void;            // 탭 → 시트 open(setEditOpen(true))
  avatarSlot?: React.ReactNode;  // me/partner Avatar 겹침 스택 JSX(LogScreen이 구성)
};
```
- accessibilityLabel="로그 이름 편집"(고정), pencil(fgAssistive) 노출, 제목 말줄임 1줄.

---

## 4. Developer 조립 가이드 (LogScreen 배선)

> ⚠️ 퍼블리셔는 `LogScreen.tsx`를 **수정하지 않았다**. 아래는 developer(T6)가 적용할 배선 가이드.

1. **헤더 제목 → 탭+pencil 전환** (현 `LogScreen.tsx:195-209` `styles.headerMain` View 블록을 `LogTitleButton`으로 교체):
   - 기존 inner row(`<View style={[styles.headerMain,...]}>` + avatarStack + `<Text navTitle>`)를 `<LogTitleButton ... />`로 대체.
   - `avatarSlot`에 기존 avatarStack JSX(`<View style={styles.avatarStack}>...me/partner Avatar...</View>`)를 그대로 넘긴다(아바타 데이터 로직 보존).
   - `title` = `displayLogName({ name: room.name, memberCount: room.memberCount, selfNickname: meNickname })` (기존 `logTitle(...)` 대체).
   - `onEdit` = `() => setEditOpen(true)`.
   - 참고: `LogTitleButton`은 이미 `flex:1, marginLeft:2`를 내장 → 기존 `styles.headerMain`(flex1·ml2)과 동일 역할. headerMain View 제거 가능.
2. **시트 마운트** (화면 하단, FAB 다음 등 — Modal 기반이라 위치 무관):
   ```tsx
   <LogNameSheet
     open={editOpen}
     initialValue={room.name ?? ''}
     placeholder={displayLogName({ name: null, memberCount: room.memberCount, selfNickname: meNickname })}
     onClose={() => setEditOpen(false)}
     onSave={handleSaveName}
     saving={renameLoading}
     error={renameError}
   />
   ```
3. **저장 핸들러**(developer): 
   ```ts
   const handleSaveName = (next: string) => {
     renameRoom({ roomId: room.roomId, name: next })  // useRenameRoom — 내부에서 normalizeLogName 적용
       .then(() => { setEditOpen(false); refresh(); showToast({ msg: '로그 이름을 변경했어요', tone: 'positive' }); })
       .catch(() => {/* error는 useRenameRoom.error → LogNameSheet error prop으로 전달 */});
   };
   ```
   - `onSave(next)`의 `next`는 **원문**(공백 포함 가능) — `useRenameRoom`/서버가 정규화(plan §3.4·§7-7 이중 정규화).
   - 성공 시 시트 close + `useRoom.refresh()`(비-낙관적, plan §3.4). 실패 시 시트 유지(입력 보존) + error 표시.
4. **표시명 일관**(plan §7-6): LogScreen 헤더(`LogTitleButton.title`)·시트 placeholder 모두 동일 `displayLogName(...)` 유틸 사용. selfNickname = LogScreen이 이미 로드한 self-profile 닉(`meNickname`).
5. **LogList 카드**(T7, 별도): `LogTitleButton`/시트 미사용 — 카드 제목만 `displayLogName(...)`로 교체(편집 진입점 없음, 카드 탭=네비 유지, plan §7-8 회귀).

---

## 5. qa-visual 대조 포인트 (킷 라인 ↔ RN 파일:라인)

- 시트 입력 보더: 킷 mk-log:95(2px #3366FF) ↔ `LogNameSheet.tsx` `inputStyle.borderWidth/borderColor`. **헤어라인 아님**(강조 보더) 확인.
- 시트 입력 radius/패딩/배경: 킷 mk-log:95 ↔ `LogNameSheet.tsx` 상수(14·14/16·surface).
- 힌트 카피·이모지: 킷 mk-log:97-98 ↔ `LogNameSheet.tsx`("💡 우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요.").
- 저장 버튼: 킷 mk-log:101(full·lg primary) ↔ `LogNameSheet.tsx` `<Button ... size="lg" full>`.
- 헤더 버튼 구조: 킷 mk-log:32-41(아바타+제목 16/Bold+pencil 15 assistive) ↔ `LogTitleButton.tsx`(avatarSlot+navTitle+Icon Pencil fgAssistive).
- pencil 글리프: 킷 mk-log:40 ↔ `assets/icons/icons.ts` `pencil`(ui-design verbatim).
- **근사 1건 확인:** 입력 폰트 굵기 600(킷) vs Bold(RN cardTitle family) — §2.1 사유 참조.
