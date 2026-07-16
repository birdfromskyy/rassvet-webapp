package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"backend/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// GetUsers must return per-user children counts in ONE response (the N+1 fix):
// a parent linked to one student reports children_counts = 1.
func TestGetUsers_ChildrenCounts(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)
	parent := e.seedUser(t, "parent@test.ru", "Passw0rd", "user", true)

	student := &models.Student{FullName: "Иволин Артём", FundingType: "budget", IsActive: true}
	require.NoError(t, e.db.Create(student).Error)
	require.NoError(t, e.db.Create(&models.UserStudent{UserID: parent.ID, StudentID: student.ID}).Error)

	cookies := e.login(t, "admin@test.ru", "Passw0rd")
	w := e.do("GET", "/api/admin/users", "", cookies)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Users          []map[string]any `json:"users"`
		ChildrenCounts map[string]int   `json:"children_counts"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	assert.Equal(t, 1, resp.ChildrenCounts[fmt.Sprint(parent.ID)],
		"parent should report exactly one linked child")
	assert.GreaterOrEqual(t, len(resp.Users), 2, "admin + parent present")
}
