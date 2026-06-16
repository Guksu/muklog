# Sprint Plan — 이름변경 다이얼로그 패턴 정합 (rename-dialog)

> 슬러그: `sprint-20260616-rename-dialog` · 작성: sprint-planner · 날짜: 2026-06-16
> 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx` `RenameDialog`(24-64) · 설계 `docs/design/architecture.md` · 발굴 `docs/sprint/_kit-delta-discovery.md`(델타 #4·#9, §5 불확실 #3)

---

## 1. 기능 한줄 정의

로그명·닉네임 편집 UX를 **하단 시트(LogNameSheet / ProfileScreen 인라인 Sheet)**에서 킷의 **중앙 다이얼로그 `RenameDialog`(iOS 알림형 · 취소/저장 행 · 초대코드 동봉)**로 통일한다.

**가치:** 킷(SSOT) 대비 비주얼 충실도 회복(델타 #4·#9 해소) + 로그명·닉네임이 **단일 공용 프리미티브** 1개로 통일되어 편집 UX 일관성·유지보수성 향상. 키보드가 떠도 가려지지 않는 상단~중앙 배치로 입력 가시성 개선.

---

## 2. 범위 (Scope)

### In-scope
- 공용 프리미티브 `RenameDialog` 신설(`src/components/RenameDialog.tsx`) — 킷 `mk-extra.jsx:24-64` RN 번역.
- **로그명 편집**: `LogNameSheet` → `RenameDialog` 교체. `LogTitleButton`(헤더 진입점)은 유지하고 `onEdit` → RenameDialog open으로 재배선.
- **닉네임 편집**: ProfileScreen 인라인 `Sheet` → `RenameDialog` 교체(공용화).
- **초대코드 동봉(`extra`)**: 로그명 다이얼로그에 **솔로(미연결) 상태에서만** `InviteCodeCard compact` 노출(스코프 결정 D-1).
- `LogNameSheet` 폐기(파일·spec 삭제, 배럴 export 제거) + 잔존참조/테스트 갱신.
- 신규/갱신 테스트(RenameDialog 단위, LogScreen·ProfileScreen 통합 갱신).

### Out-of-scope
- **DB 변경 없음.** 기존 `rename_room` RPC / `useRenameRoom` / `useUpdateProfile` / `validateNickname` 그대로 재사용.
- 입력 검증 규칙 신설 없음 — 기존 로그명(`normalizeLogName`·max 20)·닉네임(`validateNickname`·max 20) 규칙 재사용.
- 알림 설정(델타 #2)·DatePickerSheet(#6)·위시리스트(#1, 완료)·세그먼트(#3, 완료)·프로필 설정 행 재정의(#5)·솔로 배너 카피(#8) — 별도 스프린트.
- 공용 `Sheet` 프리미티브 자체는 폐기하지 않는다(장소검색·DatePicker 등 다른 소비처 존재). 본 스프린트는 이름편집 2개 소비처만 다이얼로그로 전환.

---

## 3. 스코프 결정 표

| # | 결정 사항 | 결론 | 근거 |
|---|----------|------|------|
| D-1 | 초대코드 `extra` 채택 여부 | **채택** | 킷 `mk-log:126-130`이 로그명 다이얼로그에 초대코드 동봉. 킷 정합 + 솔로 파트너 초대 유도 가치. |
| D-2 | `extra` 노출 범위(솔로 vs 커플 둘 다) | **솔로(미연결, memberCount<2)만 노출** | 커플은 방이 가득참(2명 한계) → 초대코드 무용. 헤더 편집 다이얼로그에 또 노출하면 중복·혼란. 솔로만 노출해 초대 동선 강화. 커플은 `extra` 미전달(undefined). |
| D-3 | 닉네임도 RenameDialog 공용화 포함 | **포함(로그명·닉네임 둘 다)** | 킷은 둘 다 RenameDialog(`mk-log:126-130`·`556-558`). 공용 프리미티브 1개로 통일 → 중복 시트 코드 제거, 편집 UX 일관. |
| D-4 | `LogNameSheet` 처리 | **폐기**(파일·spec·배럴 export 삭제) | RenameDialog가 전면 대체. 잔존 시 두 패턴 공존·혼란. `LogTitleButton`은 **유지**(헤더 진입점, 비주얼 불변 — 델타 #9는 진입 대상만 시트→다이얼로그로 변경). |
| D-5 | ProfileScreen 닉네임 인라인 Sheet 처리 | **RenameDialog로 교체**(인라인 `Sheet`+`TextInput` 블록 제거) | D-3 공용화. 기존 draft/validation/canSave 상태·로직은 그대로 두고 표현부만 RenameDialog로 스왑. |
| D-6 | RenameDialog 입력 모델(controlled vs self-draft) | **controlled**(`value`/`onChange` 부모 소유) | 킷이 controlled(`value`·`onChange`). `extra`·X클리어·Enter저장·검증 연동에 유리. 부모(LogScreen/Profile)가 draft 소유·open 시 초기화. |
| D-7 | 💡 힌트 카피 처리 | RenameDialog `subtitle`로 이전(💡 이모지 제거) | 킷 RenameDialog는 💡 없이 `subtitle` 텍스트만. 로그명 subtitle="비워두면 기본 이름으로 돌아가요". |

---

## 4. 데이터 · API 계약

### 4.1 DB / API — 변경 없음 (재사용 경계)
| 소비 대상 | 생산자(불변) | 시그니처 | 정규화/검증 |
|----------|------------|---------|------------|
| 로그명 저장 | `useRenameRoom()` → `rename_room(p_room_id, p_name)` RPC | `renameRoom({ roomId, name }) → { roomId, name: string\|null }` | `normalizeLogName`(빈/공백→null), 서버 재정규화. max 20. |
| 닉네임 저장 | `useUpdateProfile({ userId })` → `saveNickname({ nickname })` | 기존 시그니처 | `validateNickname({ raw })`, `NICKNAME_MAX_LENGTH=20`, 에러 토큰 `PROFILE_ERROR_MESSAGES`. |
| 폴백/표시명 | `displayLogName({ name, memberCount, selfNickname })` | 기존 | 로그명 placeholder = `displayLogName({ name: null, ... })`. |
| 초대코드 | `useRoom` → `room.inviteCode` | 기존 | `extra`에 `<InviteCodeCard code={room.inviteCode} compact />`. |

> ⚠️ C-ARG/C-LEN 불변: RPC 인자명·길이 단일 출처(20)는 기존 그대로. 본 스프린트는 표현부만 교체하므로 훅·서버 회귀 0이어야 한다.

### 4.2 `RenameDialog` props 계약 (ui-publisher 인계, **공용 프리미티브**)
파일: `src/components/RenameDialog.tsx`, 배럴 `src/components/index.ts` export. 프리젠테이션 전담(검증·정규화·RPC 없음).

```ts
export type RenameDialogProps = {
  /** 표시 여부. false면 미렌더(Modal children 마운트 안 함). */
  open: boolean;
  /** 다이얼로그 제목(가운데, 킷 800/17.5). 예: "로그 이름" · "닉네임". */
  title: string;
  /** 제목 아래 보조문(선택, 킷 500/12.5 text-alternative). 예: "비워두면 기본 이름으로 돌아가요". */
  subtitle?: string;
  /** 입력 현재값(controlled). 부모가 소유. */
  value: string;
  /** 입력 변경 콜백(controlled). */
  onChange: (next: string) => void;
  /** 취소(딤 탭 포함). 닫기·draft 폐기는 부모. */
  onCancel: () => void;
  /** 저장 탭(또는 Enter). 정규화·RPC는 부모/훅. */
  onSave: () => void;
  /** 입력 placeholder. 로그명=폴백명, 닉네임="닉네임을 입력하세요". */
  placeholder?: string;
  /** 입력 차단 길이(기본 20, C-LEN). */
  maxLength?: number;
  /** 입력 하단 추가 슬롯(킷 extra). 로그명+솔로일 때만 InviteCodeCard compact. */
  extra?: React.ReactNode;
  /** 저장 진행 중 — 저장 버튼 로딩/비활성. 기본 false. */
  saving?: boolean;
  /** 인라인 에러(서버 NAME_TOO_LONG·닉네임 검증 등). 없으면 null. */
  error?: string | null;
  /** 검증 실패 시 저장 비활성(닉네임 canSave). 기본 false(로그명은 빈값 허용=항상 활성). */
  saveDisabled?: boolean;
};
```

**동작 계약(테스트 대상):**
- `open=false` → 미렌더(null). `open=true` → Modal+딤+중앙 카드 마운트, 입력 `autoFocus`.
- 딤(배경) 탭 → `onCancel`. 카드 탭 → 전파 차단(닫히지 않음).
- 저장 버튼 탭 또는 입력 Enter(`onSubmitEditing`) → `onSave`. `saving` 또는 `saveDisabled`면 비활성.
- 입력값 있으면 X(클리어) 버튼 노출 → 탭 시 `onChange('')`.
- `maxLength` 초과 입력 차단(TextInput maxLength).
- `error` 있으면 인라인 에러 텍스트 노출. `extra` 있으면 입력 하단 슬롯 렌더.
- 접근성: 입력 `accessibilityLabel={title}`, 취소/저장 버튼 `accessibilityLabel`.

### 4.3 비주얼 계약 (ui-publisher, 킷 `mk-extra.jsx:24-64` → RN 토큰)
- 컨테이너: `Modal`(transparent) + 딤 `rgba(20,12,8,.34)`(웜 잉크 근사) + 상단~중앙 배치 `paddingTop = insets.top + 70`(킷 `ESP+70`) — 키보드 미가림.
- 카드: width 84%/maxWidth 320, radius **20**, surface 배경, 큰 그림자.
- 입력: 보더 **1.5px accent**(primary), radius **12**, 폰트 600/16, X 클리어 버튼(원형 fill·12 close 아이콘).
- 버튼 행: 상단 hairline divider + 취소(600/16 ink2) │ 1px divider │ 저장(800/16 accentStrong). 좌우 분할.
- 토큰만(raw hex/px 색 0). 음식 이모지 외 장식 없음.
- 헤더 진입(델타 #9 비주얼): `LogTitleButton` 불변(아바타 겹침 + 로그명 700/16 + pencil 15). 진입 대상만 Sheet→Dialog.

---

## 5. 화면 · 컴포넌트 목록

| 컴포넌트/화면 | 변경 | 비고 |
|--------------|------|------|
| `src/components/RenameDialog.tsx` | **신설** | 공용 프리미티브. §4.2 계약. |
| `src/components/index.ts` | 갱신 | RenameDialog export 추가. |
| `src/navigation/screens/LogScreen.tsx` | 갱신 | `LogNameSheet` → `RenameDialog`. draft 로컬 state 추가(open 시 `room.name ?? ''`로 초기화). `extra`=솔로일 때 InviteCodeCard compact. `subtitle`·`placeholder`(=fallbackName) 전달. handleSaveName 불변. |
| `src/navigation/screens/ProfileScreen.tsx` | 갱신 | 인라인 `Sheet`+`TextInput` 블록 → `RenameDialog`. 기존 draft/validation/`canSave`/`nicknameMessage` 재사용(`saveDisabled=!canSave`, `error=nicknameMessage`). |
| `src/features/room/components/LogNameSheet.tsx` | **삭제** | RenameDialog가 대체. |
| `src/features/room/components/LogNameSheet.spec.tsx` | **삭제** | 〃 |
| `src/features/room/index.ts` | 갱신 | `LogNameSheet`/`LogNameSheetProps` export 제거. `LogTitleButton`·`useRenameRoom`·`displayLogName` 유지. |
| `src/features/room/components/LogTitleButton.tsx` | **불변** | 헤더 진입점 유지(onEdit→Dialog). |

---

## 6. 작업 목록 (각 인수조건 포함)

### T1 — `RenameDialog` 공용 프리미티브 신설 (ui-publisher 비주얼 + developer 배선)
- [ ] `src/components/RenameDialog.tsx` 생성 + 배럴 export.
- **AC1.1** `open=false`면 아무것도 렌더하지 않는다(`queryByText(title)` null).
- **AC1.2** `open=true`면 title·입력(value 표시)·취소·저장 버튼이 보이고 입력에 `autoFocus`.
- **AC1.3** 딤 배경 탭 → `onCancel` 1회 호출. 카드 본문 탭 → `onCancel` 미호출.
- **AC1.4** 저장 버튼 탭 → `onSave` 1회. 입력 Enter(`onSubmitEditing`) → `onSave` 1회.
- **AC1.5** `saving=true` 또는 `saveDisabled=true`면 저장 버튼 비활성(탭해도 `onSave` 미호출), `saving=true`면 로딩 표시.
- **AC1.6** 입력에 글자 입력 → `onChange(next)` 호출. 값이 있을 때 X 버튼 탭 → `onChange('')`.
- **AC1.7** `maxLength` 초과 입력 차단(TextInput maxLength prop 전달 확인).
- **AC1.8** `error` 문자열 전달 시 인라인 노출, 미전달 시 미노출. `extra` 노드 전달 시 렌더.
- **AC1.9** 비주얼 충실도(qa-visual): 딤 색·카드 radius20·입력 1.5px accent·radius12·취소/저장 분할 행·상단 divider가 킷 `mk-extra:24-64`와 정합.

### T2 — 로그명: LogScreen RenameDialog 재배선
- [ ] `LogNameSheet` 사용부를 `RenameDialog`로 교체, draft 로컬 state 추가(open 시 `room.name ?? ''` 초기화·닫힐 때 폐기/재동기화).
- **AC2.1** 헤더 `LogTitleButton`(로그명+pencil) 탭 → RenameDialog open, 입력 초기값=현재 로그명(없으면 빈칸+placeholder=폴백명).
- **AC2.2** 입력 후 저장 → `renameRoom({ roomId, name: draft })` 호출 → 성공 시 다이얼로그 닫힘 + `refresh()` 1회 → 헤더 로그명 갱신.
- **AC2.3** 빈 입력 저장 → `normalizeLogName`이 null → 서버가 기본 이름으로 복귀(헤더=폴백명). 저장 버튼은 빈값에서도 활성(`saveDisabled` 미사용).
- **AC2.4** 저장 실패(throw) → 다이얼로그 **열린 채** 유지, 입력 보존, `useRenameRoom.error` → `error` prop 인라인 노출.
- **AC2.5** **솔로(memberCount<2)**일 때만 `extra`에 `InviteCodeCard compact`(코드=`room.inviteCode`) 노출. **커플(≥2)**이면 `extra` 미렌더.
- **AC2.6** 취소/딤 탭 → 다이얼로그 닫힘, draft 폐기(재오픈 시 현재 로그명으로 초기화).

### T3 — 닉네임: ProfileScreen RenameDialog 공용화
- [ ] 인라인 `Sheet`+`TextInput` 블록을 `RenameDialog`로 교체(기존 draft/validation/canSave 재사용).
- **AC3.1** 닉네임 편집 버튼 탭 → RenameDialog open(title="닉네임"), 입력 초기값=현재 닉네임.
- **AC3.2** 유효 입력 저장 → `saveNickname({ nickname: draft })` → 성공 시 닫힘 + `refresh()`.
- **AC3.3** 빈 닉네임 → `saveDisabled=true`(저장 비활성) + `error`="닉네임을 입력해 주세요." 노출.
- **AC3.4** 20자 초과는 입력 차단(maxLength=20); 검증 실패 시 저장 비활성 + 에러 카피.
- **AC3.5** 변경 없음(draft==현재 닉네임)이면 저장 비활성(불필요 쓰기 방지, 기존 `canSave` 규칙).
- **AC3.6** 저장 실패 → 다이얼로그 유지, `useUpdateProfile.error` 노출.
- **AC3.7** 닉네임 다이얼로그는 `extra` 미전달(초대코드 없음).

### T4 — LogNameSheet 폐기 + 잔존참조/테스트 정리
- [ ] `LogNameSheet.tsx`·`LogNameSheet.spec.tsx` 삭제, `src/features/room/index.ts`에서 export 제거.
- **AC4.1** `grep -rn "LogNameSheet" src` 결과 0건(테스트 더블 포함 모두 제거).
- **AC4.2** `LogScreen.spec.tsx`의 `LogNameSheet` 모킹 더블을 `RenameDialog` 더블로 갱신, 기존 rename 시나리오(저장/실패/로딩) green 유지.
- **AC4.3** `npx tsc --noEmit` 통과(삭제된 타입·export 미참조).

### T5 — 통합·완료 검증
- **AC5.1** `npm test` 전체 green(신규 RenameDialog.spec + 갱신된 LogScreen.spec·ProfileScreen.spec 포함, 회귀 0).
- **AC5.2** `npx tsc --noEmit` 무오류.
- **AC5.3** 코드 컨벤션 준수(화살표 함수·named-args·useEffect 명명·useCallback/useMemo 미사용·토큰 스타일링·raw hex 0).

---

## 7. 엣지케이스

**빈 상태/입력 한계**
- 로그명 빈 입력 저장 → 기본 이름 복귀(에러 아님). 닉네임 빈 입력 → 저장 비활성+에러.
- 정확히 20자 → 통과. 21번째 글자 입력 차단(maxLength). 공백만(`   `) → 로그명=정규화 null(기본명 복귀), 닉네임=`validateNickname` empty.
- 앞뒤 공백 포함 입력 → 서버/정규화가 btrim. 화면 표시는 서버 반환값(단일 출처).

**권한/상태**
- 비멤버가 rename 시도 → `rename_room` SECURITY DEFINER 멤버검증 실패 → error 인라인(다이얼로그 유지). (기존 RPC 동작, 회귀 확인.)
- 미인증/로딩 중 화면 진입 가드는 기존 LogScreen/ProfileScreen 분기 유지(다이얼로그는 ready 상태에서만 열림).

**동시성(커플 두 명)**
- 두 사용자가 동시에 로그명 변경 → 비낙관적, last-write-wins. 저장 후 `refresh()`로 서버 최종값 표시(로컬 낙관 상태 없음). 닉네임은 사용자별 분리이므로 충돌 없음.

**네트워크 실패**
- 저장 중 네트워크 끊김 → throw → 다이얼로그 열린 채 입력 보존, error 노출, 재시도 가능. `refresh`는 성공 시 1회만(비용 가드).
- 저장 진행 중(saving) 중복 탭 → 버튼 비활성으로 이중 호출 방지.

**키보드/레이아웃**
- 입력 autoFocus로 키보드 상승 → 다이얼로그가 상단~중앙(`insets.top+70`) 배치라 가려지지 않음(킷 의도). 노치/다이나믹 아일랜드는 `insets.top` 보전.
- 작은 화면(SE) 키보드 + extra(초대코드) 동시 → 카드 높이 검토(필요 시 내부 스크롤/간격 조정 — ui-publisher).

**extra(초대코드)**
- 솔로에서 다이얼로그 열기 → 코드 노출 + 본문 배너에도 노출(중복 허용, 모달이 위). 커플 전환 후 재오픈 → extra 사라짐(memberCount 기준).

---

## 8. QA가 교차검증할 경계면 목록

### qa-logic (로직·통합 정합성)
1. **RenameDialog props ↔ 소비처**: `value`/`onChange`(controlled) 계약을 LogScreen·ProfileScreen이 올바르게 소유·초기화하는가(open 시 draft 초기화, 닫힘 시 폐기).
2. **로그명 배선**: `onSave` → `renameRoom({ roomId, name: draft })` 인자·정규화·성공 시 close+refresh(1회)·실패 시 유지가 기존 `useRenameRoom` 계약과 일치(C-ARG/C-LEN 회귀 0).
3. **닉네임 배선**: `saveDisabled`=`!canSave`, `error`=`nicknameMessage` 매핑이 기존 `validateNickname`/`PROFILE_ERROR_MESSAGES`와 일치. 변경없음/빈/초과 분기.
4. **extra 솔로 게이팅**: `memberCount<2`에서만 extra 전달, 커플은 undefined.
5. **LogNameSheet 잔존참조 0**: 배럴 export·테스트 더블·import 모두 제거(tsc·grep).
6. **TDD/컨벤션**: 테스트 우선·green, 코드 컨벤션 준수.

### qa-visual (킷 시안 대비 충실도)
1. RenameDialog 비주얼 = 킷 `mk-extra:24-64`(딤 색·카드 84%/320/radius20·그림자·상단~중앙 배치).
2. 입력: 1.5px accent 보더·radius12·600/16·X 클리어 버튼.
3. 버튼 행: 상단 hairline divider·취소(ink2 600)/저장(accentStrong 800) 분할·중앙 1px divider.
4. subtitle·placeholder·title 폰트/색 토큰 정합.
5. 헤더 진입(`LogTitleButton`) 비주얼 불변(델타 #9 — 진입 대상만 변경).
6. safe-area/키보드: `insets.top+70` 배치로 노치·키보드 미겹침.

---

## 9. 비용 가드레일 체크

| 항목 | 해당 | 비고 |
|------|------|------|
| Kakao 호출 | 무관 | 이름편집은 Kakao 미호출. |
| 이미지 압축 | 무관 | 이미지 업로드 없음. |
| DB/RPC 추가 | **없음** | 기존 `rename_room`/`saveNickname` 재사용. 신규 테이블·RPC·Realtime 0. |
| 불필요 쓰기 방지 | ✅ | 닉네임 변경없음 시 저장 비활성, saving 중 중복 탭 차단, refresh 성공 시 1회. |
| Supabase 무료 티어 | ✅ 유지 | 쓰기 빈도 불변(패턴만 교체). |

---

## 10. 완료 기준 (Definition of Done)
- [ ] T1~T5 전 인수조건 충족.
- [ ] `npm test` 전체 green(회귀 0, 신규/갱신 spec 포함).
- [ ] `npx tsc --noEmit` 무오류.
- [ ] `grep -rn "LogNameSheet" src` 0건.
- [ ] 코드 컨벤션·토큰 스타일링 100% 준수(raw hex 0).
- [ ] qa-logic·qa-visual 리포트 각각 통과(`qa-report-logic.md`·`qa-report-visual.md`).
</content>
</invoke>
