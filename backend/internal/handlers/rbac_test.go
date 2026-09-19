package handlers

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAdminRoute_ForbiddenForUser(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	w := e.do("GET", "/api/admin/users", "", cookies)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAdminRoute_ForbiddenForTeacher(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "teacher@test.ru", "Passw0rd", "teacher", true)
	cookies := e.login(t, "teacher@test.ru", "Passw0rd")

	w := e.do("GET", "/api/admin/users", "", cookies)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestAdminRoute_AllowedForAdmin(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	cookies := e.login(t, "admin@test.ru", "Passw0rd")

	w := e.do("GET", "/api/admin/users", "", cookies)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestProtectedRoute_RejectsNoAuth(t *testing.T) {
	e := newTestEnv(t)
	assert.Equal(t, http.StatusUnauthorized, e.do("GET", "/api/admin/users", "", nil).Code)
}
