# dev-notes — ui-fidelity-audit (FLAG 구조 정합, developer)

작성: 2026-06-14 / developer. 범위: **FLAG-1(에디터 풀스크린, 1a)** · **FLAG-3(CreatedScreen 배선)**.
검증: `npm test` **635/635 통과** · `tsc --noEmit` 무오류. 로직/데이터 계약 불변(시트→화면 래퍼·네비 전환만).

> 역할 경계: ui-publisher=비주얼(SubBar·RoomCreatedScreen·Join/Profile·MapTab 셸), developer=구조/네비/데이터 배선.
> SubBar·RoomCreatedScreen·Join/Profile SubBar·MapTab 셸은 ui-publisher가 완료(#5·#6 비주얼·#7·#8). 본 노트는 developer 배선분만.

---

## FLAG-1 (1a): 먹로그 에디터 풀스크린 전환

**무엇이 바뀌었나**: 하단 시트(`MuklogEntrySheet`) → 풀스크린 화면(`MuklogEditor`, `<Screen>+<SubBar>`). 저장 버튼이 SubBar 우측 슬롯으로 이동. 진입은 시트 토글 → **네비게이션 라우트**(`MuklogEditor`)로 전환.

### 신규/변경 파일
| 파일 | 종류 | 책임 |
|------|------|------|
| `src/features/muklog/MuklogEditor.tsx` | 신규(프리젠테이션) | `MuklogEntrySheet` 변환 — `<Sheet>`→`<Screen>+<SubBar>`, 저장→SubBar.right, 폼/저장/사진/장소 로직 **불변**. `visible` 제거, `onClose`→`onBack`. |
| `src/features/muklog/MuklogEditor.spec.tsx` | 신규 | 기존 시트 spec 적응(폼/저장/사진/장소/편집 커버리지 보존). |
| `src/navigation/screens/MuklogEditorRoute.tsx` | 신규(컨테이너) | 라우트 진입점. `muklogId` 유무로 작성/편집 분기 + 데이터 훅 배선. |
| `src/navigation/screens/MuklogEditorRoute.spec.tsx` | 신규 | 작성/편집 분기·프리필 로딩/에러·onSubmit 배선 검증. |
| `src/features/muklog/MuklogEntrySheet.tsx`(+spec) | **삭제** | `MuklogEditor`로 대체. |
| `src/features/muklog/MuklogList.tsx` | 변경 | FAB → `navigate(MuklogEditor, { roomId })`. 시트·`usePlaceSearch`/`usePlaceSelection`·`handleSaved` 제거(장소훅은 에디터 컨테이너로 이동). |
| `src/navigation/screens/MuklogDetailRoute.tsx` | 변경 | 편집 → `navigate(MuklogEditor, { roomId, muklogId })`. 편집 시트/`useUpdateMuklog`/장소훅 제거. **포커스 refresh 추가**(에디터 저장 후 복귀 시 상세 갱신, 첫 포커스 가드). |
| `src/navigation/AppNavigator.tsx` | 변경 | `MuklogEditor` 라우트 등록(headerShown:false). |
| `src/navigation/routes.ts` | 변경 | `MuklogEditor: { roomId, muklogId? }` 추가. |
| `src/features/muklog/index.ts` | 변경 | `MuklogEntrySheet`→`MuklogEditor` export 갱신. |

### 생산자 ↔ 소비자 매핑 (경계면)
- **작성 진입**: `MuklogList`(FAB) → `navigate(MuklogEditor, { roomId })` → `MuklogEditorRoute`(muklogId 없음) → `CreateEditorRoute` → `MuklogEditor`(initial 없음, 내부 `useCreateMuklog`). 저장 성공 `onSaved` → `goBack` → `MuklogList`가 **포커스 refresh**로 +1 반영.
- **편집 진입**: `MuklogDetailScreen`(onEdit) → `MuklogDetailRoute`가 `navigate(MuklogEditor, { roomId, muklogId })` → `MuklogEditorRoute`(muklogId 있음) → `EditEditorRoute`(`useMuklog` 프리필 → `MuklogEditInitial` 매핑 → `MuklogEditor` initial/onSubmit=`useUpdateMuklog`{input, initialPhotos}). 저장 성공 `onSaved` → `goBack` → `MuklogDetailRoute` **포커스 refresh**로 갱신.
- **place 계약 불변**: `MuklogEditorRoute`가 `usePlaceSearch`/`usePlaceSelection`를 소유, `MuklogEditor`에 controlled 주입(`placeSearch`/`selectedPlace`/`onSelectPlace`/`onClearPlace`). 자동채움 sync·payload 합류는 `MuklogEditor` 내부(기존 시트와 동일).
- **저장 훅 계약 불변**: 작성=`useCreateMuklog.createMuklog({ input })`, 편집=`useUpdateMuklog.updateMuklog({ input, initialPhotos })` — shape·필드 그대로.

### 편집 프리필 조회 상태(컨테이너 처리)
`EditEditorRoute`가 `useMuklog` loading/error/notFound를 자체 처리(에디터는 ready일 때만 마운트): loading→`testID=editor-prefill-loading`, error/notFound→메시지+`돌아가기`(goBack). SubBar 골격 유지.

### 1b(완료): 장소검색 풀스크린 스왑
킷 mk-log:293 — 에디터 내부 `searching` state로 PlaceSearch **풀스크린 스왑**. 구조 완료:
- **place 필드 3-way**(form): `selectedPlace`(검색 선택) → `PlaceSelectedSummary`(placeChosen) + "변경" / `placeName`만 있음(편집 프리필·직접입력·좌표해제 후) → manual-chosen 카드 + "변경" / 미선택 → **searchBtn**(`accessibilityLabel="장소 검색하기"`). placeSearch 미주입 → 수동 TextInput(회귀 안전).
- **검색뷰**(`searching=true`, early return): **ui-publisher의 `PlaceSearchView`(킷 mk-log:383-414 정확 재현)** 채택 — 헤더(뒤로 IconButton + 검색 pill 한 줄)+결과(PlaceResultRow)+상태(loading/empty/error). §4.2 "직접 입력"은 `onUseManualInput` 주입 시 **0건 empty에서** 노출(에러는 안내 메시지만 — 재입력/뒤로). developer는 이 컴포넌트에 controlled props + 콜백만 배선.
- **전이**: searchBtn('장소 검색하기')/변경('장소 변경') → `searching=true`. 결과 탭 → `onSelectPlace`+복귀. 직접입력('직접 입력') → placeName 채택+`onClearPlace`+복귀. 뒤로('뒤로 가기') → 복귀.
- **계약 불변**: `usePlaceSearch` controlled(query/onChangeQuery/status/results/errorMessage)·자동채움 sync·payload 합류(kakaoPlaceId/lat/lng) 전부 보존.
- 테스트: MuklogEditor.spec 28건(스왑 상태머신 3건 + [B]/[C] 재설계 포함). accessibilityLabel(searchBtn="장소 검색하기"/입력="장소 검색"/"직접 입력"/"장소 변경"/"검색 취소")은 테스트 의존.
- **ui-publisher 폴리시 완료**: searchBtn(mk-log:312)·"변경"(mk-log:309)·PlaceSearchView 레이아웃·저장버튼(mk-log:296).

### 1b cleanup(dead UI 제거 + 타입 단일화)
- `PlaceSearchField.tsx`(+spec) **제거** — 인라인 검색이 PlaceSearchView로 대체돼 컴포넌트 미사용(JSX 참조 0, 타입만 남았었음).
- `PlaceSearchStatus`를 **types.ts 단일 출처**로 이전(이전엔 PlaceSearchField·usePlaceSearch 중복 정의) → usePlaceSearch/PlaceSearchView/MuklogEditor 모두 types에서 import. index.ts 타입 export 블록에 추가, PlaceSearchField/Props export 제거, PlaceSearchView export 추가.
- 검증: 640/640 통과(648−8 PlaceSearchField.spec) · tsc 0 errors.

---

## FLAG-3: CreatedScreen(로그 생성 완료 축하) 배선

**무엇이 바뀌었나**: 로그 생성 성공 → LogScreen 직행 → **축하화면(RoomCreated) 경유**(초대코드 공유 → 로그 열기/나중에).

### 신규/변경 파일
| 파일 | 종류 | 책임 |
|------|------|------|
| `src/navigation/screens/RoomCreatedScreen.tsx` | (ui-publisher 신규) | 비주얼 셸 `{ inviteCode, onEnter, onLater }`. |
| `src/navigation/screens/RoomCreatedRoute.tsx` | 신규(컨테이너) | 라우트 param(roomId, code) → 비주얼에 주입 + 네비 배선. |
| `src/navigation/screens/RoomCreatedRoute.spec.tsx` | 신규 | code 전달·onEnter(replace)·onLater(goBack) 검증. |
| `src/navigation/PlusHeaderButton.tsx` | 변경 | createRoom 성공 → refresh → `navigate(RoomCreated, { roomId, code: inviteCode })`. |
| `src/navigation/AppNavigator.tsx` | 변경 | `RoomCreated` 라우트 등록(headerShown:false). |
| `src/navigation/routes.ts` | 변경 | `RoomCreated: { roomId, code }` 추가. |

### 생산자 ↔ 소비자 매핑
- `PlusHeaderButton` → `useCreateRoom.createRoom()` 반환 `{ roomId, inviteCode }` → `navigate(RoomCreated, { roomId, code: inviteCode })`.
- `RoomCreatedRoute`(useRoute params) → `RoomCreatedScreen`{ inviteCode=code, onEnter, onLater }.
  - `onEnter`("로그 열기") → `navigation.replace(LogScreen, { roomId })`(축하화면을 LogScreen으로 교체 → 뒤로가기 시 홈).
  - `onLater`("나중에"/뒤로) → `navigation.goBack()`(홈 목록 복귀; 목록은 생성 직후 `myLogs.refresh()`로 이미 +1).
- **멀티로그 생성 플로우 충돌 없음**: create_room → 목록 refresh(+1) → 축하화면. 목록 추가는 생성 시점에 끝남(축하화면 분기와 독립).

---

## 변경 안 한 것(타 역할/후속)
- SubBar·RoomCreatedScreen 비주얼·Join/Profile SubBar·MapTab 셸 = ui-publisher.
- 에디터 저장버튼 정확 스타일(accent-strong/disabled, mk-log:296)·검색 풀스크린(1b) = ui-publisher 폴리시 대기.
- `git` 작업 없음(사용자 직접).

## QA 교차검증 요청 포인트
1. 작성 플로우: FAB→에디터→저장→목록 복귀+갱신(포커스 refresh) 정합.
2. 편집 플로우: 상세→편집→저장→상세 복귀+갱신. 프리필 좌표/사진 보존(useUpdateMuklog initialPhotos).
3. 생성 플로우: + → 새 로그→축하화면→(로그 열기 replace / 나중에 goBack). 목록 +1.
4. 라우트 등록 ↔ navigate 인자 일치(MuklogEditor {roomId,muklogId?} / RoomCreated {roomId,code}).
5. 헤더 이중화 없음(에디터·축하·Join·Profile 모두 headerShown:false + 자체 SubBar).
