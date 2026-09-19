package handlers

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLogin_Success(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)

	w := e.do("POST", "/api/login", `{"email":"user@test.ru","password":"Passw0rd"}`, nil)

	assert.Equal(t, http.StatusOK, w.Code)
	// both auth cookies must be set
	var names []string
	for _, c := range w.Result().Cookies() {
		names = append(names, c.Name)
	}
	assert.Contains(t, names, "token")
	assert.Contains(t, names, "refresh_token")
}

func TestLogin_WrongPassword(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)

	w := e.do("POST", "/api/login", `{"email":"user@test.ru","password":"WRONG"}`, nil)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Empty(t, w.Result().Cookies(), "no session should be issued on wrong password")
}

func TestLogin_UserNotFound(t *testing.T) {
	e := newTestEnv(t)
	w := e.do("POST", "/api/login", `{"email":"nobody@test.ru","password":"Passw0rd"}`, nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestLogin_NotVerified(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "unverified@test.ru", "Passw0rd", "user", false)
	// pre-set the resend cooldown so the handler returns 403 without hitting SMTP.
	require.NoError(t, e.rdb.Set(context.Background(),
		verificationCooldownKey("unverified@test.ru"), "1", time.Minute).Err())

	w := e.do("POST", "/api/login", `{"email":"unverified@test.ru","password":"Passw0rd"}`, nil)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestMe_RequiresAuth(t *testing.T) {
	e := newTestEnv(t)
	w := e.do("GET", "/api/me", "", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMe_WithAuth(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	w := e.do("GET", "/api/me", "", cookies)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "user@test.ru")
}

func TestLogout_InvalidatesSession(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	// /me works before logout
	require.Equal(t, http.StatusOK, e.do("GET", "/api/me", "", cookies).Code)

	// logout blacklists the access token
	require.Equal(t, http.StatusOK, e.do("POST", "/api/logout", "", cookies).Code)

	// the same access cookie is now rejected
	assert.Equal(t, http.StatusUnauthorized, e.do("GET", "/api/me", "", cookies).Code)
}

func TestRefresh_NoCookie(t *testing.T) {
	e := newTestEnv(t)
	w := e.do("POST", "/api/refresh", "", nil)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRefresh_Success(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	w := e.do("POST", "/api/refresh", "", cookies)

	require.Equal(t, http.StatusOK, w.Code)
	// a fresh pair is issued
	var names []string
	for _, c := range w.Result().Cookies() {
		names = append(names, c.Name)
	}
	assert.Contains(t, names, "token")
	assert.Contains(t, names, "refresh_token")
}
