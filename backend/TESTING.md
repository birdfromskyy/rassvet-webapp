# Backend tests

API/handler tests that run against **real Postgres** (the app is Postgres-specific)
and are fully isolated — they never touch dev/prod data.

## How to run

```bash
# 1. Postgres must be up (dev compose maps it to localhost:5433)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis

# 2. run the tests (reads DB_USER/DB_PASSWORD from backend/.env)
cd backend
go test ./internal/handlers/ -v
```

If no Postgres is reachable the package **skips** (never hard-fails), so
`go test ./...` is safe in any environment.

## Isolation model ("откат к прежнему состоянию")

- A throwaway database **`reviews_test`** is created and migrated once (`TestMain`).
- **Every test runs inside a transaction that is rolled back** on cleanup → zero
  residue, dev/prod `reviews_db` is never modified.
- Redis is an **in-process miniredis** — nothing real is touched.

Override the target with env vars if needed: `TEST_DB_HOST`, `TEST_DB_PORT`,
`TEST_DB_NAME`, `DB_USER`, `DB_PASSWORD`.

## What's covered

| Area | Tests |
|------|-------|
| Login | success, wrong password, user-not-found, not-verified |
| Session | /me auth required, logout invalidates token, refresh success/no-cookie |
| Security | password change revokes other devices, keeps current one |
| RBAC | admin route forbidden for user/teacher, allowed for admin, no-auth rejected |
| Reviews | create, one-per-user, teacher-forbidden, approve→published |
| Admin users | children counts returned in one query (N+1 fix) |

Registration and password-recovery flows are intentionally **not** tested.

## Adding a test

```go
func TestSomething(t *testing.T) {
    e := newTestEnv(t)                       // isolated tx + miniredis + router
    e.seedUser(t, "u@test.ru", "Passw0rd", "user", true)
    cookies := e.login(t, "u@test.ru", "Passw0rd")
    w := e.do("GET", "/api/whatever", "", cookies)
    require.Equal(t, http.StatusOK, w.Code)
}
```

Mount any additional routes you need in `buildTestRouter` (harness_test.go).
