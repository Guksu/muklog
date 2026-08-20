# dev-notes — invite-code-hardening

## 산출물

| 파일 | 변경 |
|------|------|
| `supabase/migrations/20260820120000_invite_code_hardening.sql` | 신설 — `invite_join_attempts` 테이블 + `join_room` 시도 제한 replace + `create_room` CSPRNG replace |
| `src/features/room/errors/errors.ts` | `TOO_MANY_ATTEMPTS` 토큰 카피 추가(13종) |
| `src/features/room/useJoinRoom/useJoinRoom.ts` | jsonb `{error}` 반환 계약 → 토큰 throw 변환 |
| `src/features/room/errors/errors.spec.ts` | 신규 토큰 매핑 + 키 12→13 불변식 갱신 |
| `src/features/room/useJoinRoom/useJoinRoom.spec.ts` | `{error}` 계약·`TOO_MANY_ATTEMPTS` 케이스 추가 |
| `docs/design/architecture.md` | §3 스키마(`invite_join_attempts`·invite_code CSPRNG 주석) + §5 스프린트 행 |

## TDD

Red(신규 3 실패 확인) → Green(구현) → 기존 키 개수 불변식 테스트만 12→13 동반 갱신. `src/features/room` 178 green, 전체 스위트 통과(커밋 시점 기준).

## 설계 결정 기록

1. **`INVALID_CODE` raise → jsonb `{error}` 반환**: plpgsql `raise`는 트랜잭션 롤백으로 실패 카운터 INSERT까지 지운다(카운터 영속의 유일한 장애물). 반환 계약으로 전환하고 클라 훅이 throw로 변환 — 화면(JoinLogScreen) 이하 소비자는 무변경. `TOO_MANY_ATTEMPTS`는 읽기 전용 가드라 raise 유지.
2. **고정 윈도우 + 지연 리셋**: 만료된 윈도우는 다음 실패 때 1로 리셋 — cron/스케줄러/정리 작업 0(AWS 0·무료 티어 원칙). 행 수는 사용자 수 이하로 유계.
3. **모듈로 편향 0**: charset 32자가 256의 약수라 `get_byte % 32` 균등 — charset을 바꾸면 이 성질을 깨지 않도록 SQL 주석에 명시.
4. **테이블 접근 차단 이중화**: RLS(정책 0) + `revoke all` — Supabase 기본 GRANT(public 스키마 → authenticated) 회수.

## 라이브 이월 (사용자 전담)

- `supabase db push` — pgcrypto는 Supabase 기본 활성이라 추가 설정 없음.
- **배포 순서 안전**: DB 선적용 시 구 JS 번들은 INVALID_CODE에서 기본 에러 카피로 강등될 뿐 기능 무해(plan §5). 다음 OTA/릴리스에 클라 변경 포함.
- 라이브 스모크: 잘못된 코드 10회 → 11번째 `TOO_MANY_ATTEMPTS` 카피 확인 → 유효 코드로 정상 입장 확인(1시간 후 또는 카운터 수동 삭제).
