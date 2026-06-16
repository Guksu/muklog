# dev-notes — 방문일 캘린더 시트 (date-picker)

> 배선 단계 구현 노트. 단일 출처: `plan.md`(결정 D1~D6) · `ui-spec.md`(§3 props·§4 행 골격).
> **이력 주의:** developer-3가 TDD Red(테스트)·calendarGrid·formatVisitedDate·DatePickerSheet import까지 작성 후 **MuklogEditor 렌더 배선 직전에 응답 불가(중단)**. 오케스트레이터(team-lead)가 멈춘 지점부터 잔여 배선을 이어받아 Green 완료. 구현 내용·계약은 plan/ui-spec 그대로 준수.

## 완료 항목
1. **calendarGrid.ts**(ui-publisher 초기본) — 월 그리드·`isFutureDate`·`isToday`·`moveMonth`·`toISODate`/`parseISODate`. T1 스위트 green(시그니처=계약 불변).
2. **formatVisitedDate.ts** — `withDow` 옵션 확장(`YYYY.MM.DD (요일)`, 킷 fmtDate(iso,true)). 저장 포맷 `YYYY-MM-DD` 불변. T2 green.
3. **DatePickerSheet.tsx**(ui-publisher) — props `{ visible; value; onClose; onSelect:({date}) }`. controlled. T3 green.
4. **MuklogEditor.tsx 배선**(T4):
   - 방문일 `<TextInput>`(구 value/onChangeText) **완전 제거** → 탭형 `Pressable` 날짜 행(calendar 19 primary + `formatVisitedDate({visitedAt,withDow:true})` dateRowValue + chevron-down 18 fgAssistive, border 1.5 hairline, radius 16).
   - `const [dateOpen, setDateOpen] = useState(false)` — 행 onPress→열기.
   - `<DatePickerSheet visible={dateOpen} value={visitedAt} onClose={닫기} onSelect={({date})=>{ setVisitedAt(date); 닫기 }} />`.
   - 미래 차단: 시트 disable(킷) + `normalizeMuklogInput` future throw 이중 방어 유지. 기본값 `todayLocalDate()` 유지.
5. **T-MIG**: MuklogEditor.spec 방문일 TextInput 단언 → 날짜 행 표시 단언(`방문일 2026.02.14 (토), 선택`). 저장 payload `visitedAt` 단언 유지(회귀 가드). + T4 describe 블록(AC4.1~4.6).

## 경계면 (생산자 ↔ 소비자)
| 경계 | 생산자 | 소비자 | 점검 |
|------|--------|--------|------|
| 날짜 선택 → 상태 | DatePickerSheet `onSelect({date})` | MuklogEditor `setVisitedAt(date)` | ISO 'YYYY-MM-DD' 전달, 시트 자동 닫힘 |
| 선택값 표시 | `formatVisitedDate({visitedAt,withDow:true})` | 날짜 행 Text | 'YYYY.MM.DD (요일)', null→'날짜 미정' |
| 그리드/미래/오늘 | calendarGrid 유틸 | DatePickerSheet | 로컬 today(UTC 시프트 없음) |
| 저장 계약 | MuklogEditor visitedAt | createMuklog/updateMuklog payload | **'YYYY-MM-DD' 불변**(회귀 가드 :498/:501) |
| 미래 차단 | 시트 disable + normalizeMuklogInput | 저장 검증 | 이중 방어 |

## DB / 비용
- **DB·마이그레이션 변경 0**. `visitedAt`/`visited_at` 컬럼·먹로그 mutation 전부 재사용. 저장 계약 불변.
- 신규 외부 호출 0(Kakao·Realtime·폴링 없음).

## 검증
- `npm test` → **121 suites / 988 tests 전체 green**(회귀 0).
- `npx tsc --noEmit` → exit 0.
- `grep accessibilityLabel="방문일"` (구 TextInput) → 0건(제거 확인).

## QA 인계
- qa-visual: §4 진입 행 + 통합(시트 오픈·선택 반영·TextInput 제거) PENDING 재검증 진입 가능.
- qa-logic: 경계면·미래 이중방어·저장 계약 불변·calendarGrid 엣지·컨벤션 교차검증 진입 가능.
