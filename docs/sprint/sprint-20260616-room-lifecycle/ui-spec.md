# UI Spec: room-lifecycle (나가기 · 예약삭제 · 취소)

> **디자인 출처: 킷 비종속** (plan §0/D7). 킷 `templates/muklog`에 나가기/예약삭제/취소 UI **없음**.
> → 킷 1:1 번역이 아니라 **기존 muklog 패턴·프리미티브 정합**: MuklogDetail(`mk-log:195-217`)의 ⋯메뉴 + danger 확인 시트 패턴 + 기존 Sheet·Button·Text·Icon·토큰 재사용. **새 비주얼 발명 최소화.**
> qa-visual은 킷 라인 대조 대신 **기존 패턴 정합**으로 검증한다(§ 충실도 체크리스트).

---

## 0. 산출물 요약

| 산출물 | 경로 | 비고 |
|---|---|---|
| 예약삭제 배너(presentational) | `src/features/room/ScheduledDeletionBanner.tsx` | + `.spec.tsx` (5 케이스) |
| 나가기 메뉴+확인 시트(presentational) | `src/features/room/LeaveLogSheets.tsx` | + `.spec.tsx` (11 케이스) |
| 토큰 추가 | `src/theme/tokens.ts` | `negativeWeak`(light/dark) |
| 배럴 export | `src/features/room/index.ts` | 두 컴포넌트 + 타입 |

- **두 컴포넌트는 완전 presentational**(props in / 콜백 out, 데이터 계산·RPC·nav 없음) → 단독 tsc-clean·테스트 격리.
- developer는 이 둘을 **LogScreen에 마운트하고 훅에 배선**한다(§3 통합 레시피).

---

## 1. 기존 패턴 ↔ 신규 UI 매핑 (킷 라인 대신 패턴 근거)

| 신규 UI | 재사용 패턴(근거 파일:라인) | RN 매핑 |
|---|---|---|
| ⋯ 메뉴 시트(단일 danger 행 "로그 나가기") | MuklogDetail ⋯메뉴 `MuklogDetailScreen.tsx:441-467` (킷 `mk-log:195-202`) | `Sheet`(공용) + `MenuRow`(danger, `IconName.Trash`, `negative` 토큰) 패턴 복제 |
| 나가기 확인 시트(카피 분기) | MuklogDetail 삭제 확인 `MuklogDetailScreen.tsx:469-515` (킷 `mk-log:204-217`) | `Sheet` + 중앙 본문(`bodySm`/`fgMuted`) + **danger 버튼**(`Pressable` `negative`bg/`negativeFg`) + `Button` ghost "취소" |
| danger 버튼(나가기/삭제하기) | MuklogDetail `deleteBtn` `MuklogDetailScreen.tsx:481-505` | 동일 인라인 패턴(negative bg, ActivityIndicator on loading, disabled opacity 0.45) |
| 예약삭제 배너 | SoloInviteBanner 약톤 카드 `LogScreen.tsx:120-142` (킷 `mk-log:33-45`) | 약톤 카드(`negativeWeak` bg, `radius.sheet`) + `CircleInfo`(negative) + 메시지 + `Button` secondary sm |
| 취소 버튼 카피 행 | CompactInviteRow "복사" `LogScreen.tsx:104-113` | 배너 내 우측 액션(여기선 `Button` secondary로 탭 명확성↑) |

**왜 패턴 복제(공유 프리미티브 추출 아님):** plan D7 "새 비주얼 발명 최소화, 기존 패턴 답습". `MenuRow`/danger 버튼은 MuklogDetail 내부 비공개 헬퍼라 import 불가 → **확립된 패턴을 동일 토큰·치수로 복제**(드리프트 위험은 qa-visual 패턴 정합으로 가드).

---

## 2. 토큰 변경

### 추가: `negativeWeak` (`src/theme/tokens.ts`)
- **사유:** plan §4 "예약삭제 배너 배경 = status-negative weak 톤". 기존에 `negative`(#E5484D, 파괴 CTA)는 있으나 **약톤(weak)이 없음**.
- **기존 토큰 충당 검토:** `errorWeak`(#FEECEC) 재사용 가능하나, tokens.ts 주석이 `error*`=「검증/조회 실패 텍스트」, `negative`=「파괴 CTA」로 의미를 분리 → 파괴 *상태* 배너 배경은 `negative` 계열이 의미상 정확. 정확한 #E5484D 틴트를 묶기 위해 전용 약톤 추가.
- **값:** light `rgba(229,72,77,0.10)` / dark `rgba(229,72,77,0.22)`(어두운 surface 가독 위해 진하게, **다크 미러 override**).
- raw hex 0 유지(컴포넌트는 `theme.color.negativeWeak`만 참조).

**그 외 토큰 변경 없음.** 나머지는 전부 기존 토큰(`negative`/`negativeFg`/`fg`/`fgMuted`/`error`/`radius.sheet`/`radius.control`/`spacing.*`)로 충당.

---

## 3. props 계약 + LogScreen 통합 레시피 (developer용)

### 3.1 `ScheduledDeletionBanner`
```ts
type ScheduledDeletionBannerProps = {
  countdownLabel: string;   // developer: deletionCountdownLabel({ scheduledAt, now }) 결과
  isRequester: boolean;     // developer: meId === room.deleteRequestedBy
  onCancel: () => void;     // developer: cancelRoomDeletion → 성공 시 refresh
  canceling?: boolean;      // developer: useCancelRoomDeletion.loading
};
```
- 카피(컴포넌트 SSOT): 요청자 `이 로그는 {label} 예정이에요` / 상대 `상대가 로그에서 나가 {label} 예정이에요`.
- **취소 버튼은 `isRequester=true`일 때만** 렌더(상대 미노출 = 이중 방어, plan §6).
- **노출 게이팅은 developer**: `room.deleteScheduledAt != null`일 때만 이 컴포넌트를 렌더(컴포넌트 내부엔 visible 분기 없음).

### 3.2 `LeaveLogSheets`
```ts
type LeaveLogSheetsProps = {
  menuVisible: boolean;        // LogScreen 헤더 ⋯ 버튼 → setMenuOpen(true)
  confirmVisible: boolean;     // 메뉴 "로그 나가기" → setConfirmOpen(true)
  isCouple: boolean;           // room.memberCount >= 2
  onCloseMenu: () => void;
  onSelectLeave: () => void;   // 부모: setMenuOpen(false); setConfirmOpen(true)
  onCloseConfirm: () => void;
  onConfirmLeave: () => void;  // developer: leaveRoom → 성공 분기(아래)
  leaving?: boolean;           // useLeaveRoom.loading
  leaveError?: string | null;  // useLeaveRoom.error
};
```
- 카피(컴포넌트 SSOT): 커플 `로그에서 나갈까요?` + 24h 유예 본문 + danger `나가기` / 솔로 `로그를 삭제할까요?` + 되돌릴 수 없음 본문 + danger `삭제하기`. 공통 ghost `취소`.
- **확인 시트는 성공 시 스스로 닫지 않음** → developer가 `onConfirmLeave` 성공 분기에서 닫는다(MuklogDetail/RenameDialog와 동일 controlled 패턴).

### 3.3 LogScreen 통합(개발자 배선 — 비주얼 골격 위치)
LogScreen은 훅 소유 라우트 화면이라 presentational 아님 → developer가 아래대로 마운트한다. **비주얼 골격(위치·치수)은 본 spec이 고정**, 데이터/RPC만 채운다.

1. **헤더 ⋯ 버튼** — `LogScreen.tsx` 헤더 행(`logscreen-header`, 현재 `IconButton(ChevronLeft)` + `LogTitleButton`) **우측 끝**에 추가:
   ```tsx
   <IconButton name={IconName.MoreHorizontal} size={24} color="fg"
     accessibilityLabel="더보기" onPress={() => setMenuOpen(true)} />
   ```
   레이아웃: 헤더는 `flexDirection:'row'`. `LogTitleButton`이 `flex:1`로 가운데를 먹으므로 ⋯는 자연히 우측 끝. (필요 시 `LogTitleButton` 래퍼에 `flex:1` 확인.)
2. **예약삭제 배너** — 세그먼트(`segWrap`) **위, 헤더 아래**에 조건부:
   ```tsx
   {room.deleteScheduledAt ? (
     <View style={{ paddingHorizontal: theme.spacing[20], paddingTop: theme.spacing[8] }}>
       <ScheduledDeletionBanner
         countdownLabel={deletionCountdownLabel({ scheduledAt: room.deleteScheduledAt, now: Date.now()/* 또는 갱신 소스 */ })}
         isRequester={meId === room.deleteRequestedBy}
         onCancel={() => void handleCancelDeletion()}
         canceling={canceling} />
     </View>
   ) : null}
   ```
   ⚠️ 세그 위 항상 표시(위시 세그 포함) — 예약은 로그 전체 상태이므로 세그 무관 노출. (초대영역과 달리 세그별 분기 없음.)
3. **시트 2종** — `Screen` 말미(Toast 옆)에 마운트:
   ```tsx
   <LeaveLogSheets
     menuVisible={menuOpen} confirmVisible={confirmOpen} isCouple={isCouple}
     onCloseMenu={() => setMenuOpen(false)}
     onSelectLeave={() => { setMenuOpen(false); setConfirmOpen(true); }}
     onCloseConfirm={() => setConfirmOpen(false)}
     onConfirmLeave={() => void handleLeave()}
     leaving={leaving} leaveError={leaveError} />
   ```
4. **성공 분기(developer)** — plan §4:
   - `handleLeave`: `leaveRoom({ roomId })` → `scheduled`(커플) = `setConfirmOpen(false)` + `refresh()`(배너 표시·화면 유지) / `roomDeleted`(솔로) = `navigation.goBack()` + 목록 refresh. 실패 = 시트 유지(`leaveError` 인라인).
   - `handleCancelDeletion`: `cancelRoomDeletion({ roomId })` → 성공 `refresh()`(배너 사라짐). 실패 Toast.
5. **로컬 UI 상태**(developer): `const [menuOpen, setMenuOpen] = useState(false); const [confirmOpen, setConfirmOpen] = useState(false);` — 순수 boolean(데이터 아님).

---

## 4. RN 근사 / 미재현 기록 (충실도 한계)

- **danger 버튼**은 공용 `Button`이 negative variant를 갖지 않아(현재 primary/soft/ghost/secondary) MuklogDetail과 동일하게 **인라인 `Pressable`로 복제**. 공용화는 별도 결정(이번 OUT, plan "새 비주얼 발명 최소화").
- **Sheet 상단 라운드 26·딤 0.32**은 공용 `Sheet`가 이미 근사(blur 미지원 → 반투명) — 본 UI는 그 위에 얹어 일관.
- 배너 **상태 변화 애니메이션 없음**(등장/소멸) — plan 범위 외. refresh로 마운트/언마운트.

---

## 5. 충실도 체크리스트 (qa-visual — 패턴 정합)

킷 라인 대조 **불가**(킷 비종속). 아래 **기존 패턴 정합**으로 검증:

- [ ] **⋯ 메뉴 행** = MuklogDetail `MenuRow` danger와 동일 토큰/치수: 아이콘 21·`negative` 틴트·`body` 라벨·padding(v14/h8)·gap14. (`MuklogDetailScreen.tsx:520-553`)
- [ ] **danger 버튼**("나가기"/"삭제하기") = MuklogDetail `deleteBtn` 동일: `negative` bg·`negativeFg` `button` 텍스트·`radius.control`·paddingV14·loading 시 ActivityIndicator·disabled opacity. (`:481-505`)
- [ ] **확인 시트 본문** = 중앙정렬 `bodySm`/`fgMuted` + `\n` 줄바꿈 + 하단 margin18. (`:471-473`)
- [ ] **ghost "취소"** = `Button variant="ghost" full`. (`:506-513`)
- [ ] **에러 인라인** = `bodySm`/`error` 중앙, 시트 유지. (`:474-478`)
- [ ] **배너** = SoloInviteBanner 약톤 카드 패턴(약톤 bg·`radius.sheet`·padding) + status-negative 톤(`negativeWeak` bg, `CircleInfo` negative 아이콘). (`LogScreen.tsx:120-142`)
- [ ] **취소 버튼**은 **요청자만** 노출, 상대는 안내만(plan §4·§6 이중 방어).
- [ ] **카피 정확성**(plan §4): 커플 "로그에서 나갈까요?"/24h 유예/"나가기" · 솔로 "로그를 삭제할까요?"/"되돌릴 수 없어요"/"삭제하기" · 배너 "이 로그는 …예정이에요"/"상대가 로그에서 나가 …예정이에요".
- [ ] **raw hex/숫자 색상 0** — 전부 토큰(`negative`/`negativeFg`/`negativeWeak`/`fg`/`fgMuted`/`error`).
- [ ] **세그 위·헤더 아래** 배너 위치, 세그 무관 노출(위시 세그에서도).

---

## 6. 경계 (ui-publisher ↔ developer)

| 영역 | 담당 |
|---|---|
| 시트/배너 비주얼·카피·토큰·치수, props 계약 | **ui-publisher(나)** |
| `leave_room`/`cancel_room_deletion` RPC·훅, `deletionCountdownLabel` 계산, 예약 상태 조회, nav(goBack)·refresh, `menuOpen/confirmOpen` 로컬 상태 배선, LogScreen 마운트 | **developer** |

> ⚠️ **developer 인계 메모(tsc gate):** `MyLog` 확장(`deleteScheduledAt`/`deleteRequestedBy`)으로 `src/features/profile/profileStats.spec.ts` 픽스처가 두 필드 누락 → `tsc --noEmit` 3건 에러(내 산출물 아님, MyLog 소유=developer). 픽스처에 두 필드(`null`) 보강 필요. 내 3개 파일은 tsc-clean, `npm test` 1081 green.
