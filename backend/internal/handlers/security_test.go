package handlers

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Changing the password must revoke every OTHER session (log out other devices),
// while the device that changed it stays logged in with a fresh session.
func TestPasswordChange_RevokesOtherSessions(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)

	deviceA := e.login(t, "user@test.ru", "Passw0rd")
	deviceB := e.login(t, "user@test.ru", "Passw0rd")

	// device B has a working session before the change
	require.Equal(t, http.StatusOK, e.do("GET", "/api/me", "", deviceB).Code)

	// device A changes the password
	w := e.do("PUT", "/api/profile",
		`{"first_name":"Test","last_name":"User","password":"NewPass123"}`, deviceA)
	require.Equal(t, http.StatusOK, w.Code, w.Body.String())

	// device B's refresh token is revoked → it can no longer renew its session
	assert.Equal(t, http.StatusUnauthorized, e.do("POST", "/api/refresh", "", deviceB).Code,
		"other device should be logged out after password change")

	// device A received a fresh session in the response and still works
	freshA := w.Result().Cookies()
	assert.Equal(t, http.StatusOK, e.do("POST", "/api/refresh", "", freshA).Code,
		"the device that changed the password stays logged in")
}
