# sprint-20260820-invite-code-hardening — 초대코드 브루트포스 완화(보안)

## 1. 배경 (왜 지금)

퍼블릭 저장소 보안 검토(2026-08-20)의 유일한 실질 공격면 후속 조치.

- 저장소 공개로 초대코드의 **charset(32자)·길이(6자, 32^6 ≈ 10.7억 조합)·RPC 이름(`join_room`)·에러 토큰(`INVALID_CODE`)** 이 전부 노출 → 공격 스크립트 작성 장벽 소멸.
- 기존 `join_room`에 서버측 속도 제한이 없어 **인증 계정 하나로 무제한 추측** 가능(익명 인증은 폐기됐으므로 Google/Apple 로그인 비용은 있음).
- `create_room`의 코드 생성이 `random()`(비암호학적 난수) — 이론상 예측 여지.

## 2. 범위 (1 스프린트 = 1 기능: 초대코드 하드닝)

| # | 항목 | 내용 |
|---|------|------|
| S1 | 시도 제한 | `invite_join_attempts` 테이블(사용자별 실패 카운터) + `join_room` 가드: 고정 윈도우 **실패 10회/1시간** 초과 시 `TOO_MANY_ATTEMPTS` |
| S2 | CSPRNG | `create_room` 코드 생성 `random()` → pgcrypto `gen_random_bytes` |
| S3 | 클라 동기화 | `useJoinRoom` `{error}` 반환 계약 처리 + `errors.ts` `TOO_MANY_ATTEMPTS` 카피 |

OUT: 코드 길이 확장(8자), 코드 TTL/회전, IP 기반 제한(Supabase 무료 티어에서 수단 없음 — AWS 0 원칙), 캡차.

## 3. 데이터 계약

### 3.1 `invite_join_attempts` (신설)

```
user_id           uuid PK → profiles ON DELETE CASCADE
failed_count      int not null default 0
window_started_at timestamptz not null default now()
```

- **DEFINER(join_room) 전용**: RLS 활성 + 정책 0 + `revoke all`(anon·authenticated) → 클라이언트 접근 완전 차단.
- 행 수 ≤ 사용자 수(PK), 계정 삭제 시 profiles cascade — **정리 cron 불필요(지연 리셋)**.

### 3.2 `join_room(p_code)` 계약 변경 ⚠️

| 케이스 | 기존 | 변경 |
|--------|------|------|
| 성공 | `{ room_id }` | 불변 |
| 코드 불일치 | `raise 'INVALID_CODE'` | **`{ "error": "INVALID_CODE" }` 반환** + 실패 카운터 upsert |
| 제한 초과 | (없음) | `raise 'TOO_MANY_ATTEMPTS'` (신규) |
| 그 외 | `raise NOT_AUTHENTICATED / ROOM_FULL` | 불변 |

**반환 전환 이유**: plpgsql `raise`는 트랜잭션 전체를 롤백해 실패 카운터 INSERT까지 지운다. 카운터가 커밋되려면 정상 반환이어야 한다. `TOO_MANY_ATTEMPTS`는 읽기 전용 가드라 raise 유지(롤백 무해).

**정책 상세**: 실패 시 upsert — 활성 윈도우면 `failed_count + 1`, 윈도우(1시간) 만료면 `1`로 리셋 + 윈도우 재시작. 코드 일치 시 카운터 행 삭제(정상 사용자의 오타 누적 해소). 가드는 카운터 행 `for update` 잠금으로 동시 호출 직렬화.

### 3.3 `create_room(p_mode)` — 코드 생성만 변경

`gen_random_bytes(6)` → 바이트별 `get_byte % 32`로 charset 인덱싱. **charset 32자 = 256의 약수 → 모듈로 편향 0** (charset 변경 시 이 성질 유지 필요, 주석 명시). 반환·토큰·모드 검증·UNIQUE 재시도 루프 불변.

## 4. 인수 조건

1. 활성 윈도우 안 실패 10회 후 11번째 호출은 코드 유효 여부와 무관하게 `TOO_MANY_ATTEMPTS`.
2. 윈도우 만료 후 첫 실패는 카운터 1로 리셋(재시도 가능).
3. 코드 일치(성공·멱등 재조인 포함) 시 카운터 삭제.
4. `INVALID_CODE`에서 실패 카운터가 **커밋**된다(반환 계약).
5. 클라: `{error}` 반환 → 토큰 throw → 기존 한국어 카피 불변, `TOO_MANY_ATTEMPTS` → "입장 시도가 너무 많았어요. 1시간 뒤에 다시 시도해 주세요."
6. `invite_join_attempts`는 클라이언트 anon/authenticated로 select/insert 불가.
7. `npm test` 전체 green.

## 5. 엣지 케이스

- **구 JS 번들(이미 배포)**: `{error}` 반환을 모르면 `room_id` 부재 → `JOIN_ROOM_BAD_RESPONSE` → 기본 카피("연결에 실패했어요")로 강등. 입장 차단·크래시 없음(기능 무해) — OTA/다음 릴리스로 해소. DB 선적용 OK.
- 동시 실패 2건: upsert + PK 충돌 경로로 원자적 누적. 가드의 `for update`가 직렬화.
- `ROOM_FULL` raise 시 성공 리셋(delete)도 롤백 → 카운터 보존(코드는 맞았으나 정원 초과 — 추측 실패 아님이라 이상적으론 리셋이지만, 보존이 보안상 안전한 쪽이라 수용).
