package handlers

import (
	"fmt"
	"net/http"
	"testing"

	"backend/internal/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateReview_Success(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	w := e.do("POST", "/api/reviews",
		`{"rating":5,"content":"Отличный центр, всё понравилось!"}`, cookies)

	assert.Equal(t, http.StatusCreated, w.Code, w.Body.String())
}

func TestCreateReview_OnePerUser(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	cookies := e.login(t, "user@test.ru", "Passw0rd")

	require.Equal(t, http.StatusCreated,
		e.do("POST", "/api/reviews", `{"rating":5,"content":"Первый отзыв о центре."}`, cookies).Code)

	// second review is rejected
	w := e.do("POST", "/api/reviews", `{"rating":4,"content":"Второй отзыв о центре."}`, cookies)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateReview_TeacherForbidden(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "teacher@test.ru", "Passw0rd", "teacher", true)
	cookies := e.login(t, "teacher@test.ru", "Passw0rd")

	w := e.do("POST", "/api/reviews", `{"rating":5,"content":"Преподаватель пишет отзыв."}`, cookies)
	assert.Equal(t, http.StatusForbidden, w.Code)
}

// A pending review is not public; after admin approval it appears in the list.
func TestReviewModeration_ApprovePublishes(t *testing.T) {
	e := newTestEnv(t)
	e.seedUser(t, "user@test.ru", "Passw0rd", "user", true)
	e.seedUser(t, "admin@test.ru", "Passw0rd", "admin", true)

	userCookies := e.login(t, "user@test.ru", "Passw0rd")
	require.Equal(t, http.StatusCreated,
		e.do("POST", "/api/reviews", `{"rating":5,"content":"Ожидает модерации отзыв."}`, userCookies).Code)

	// not public while pending
	require.NotContains(t, e.do("GET", "/api/reviews", "", userCookies).Body.String(), "Ожидает модерации")

	// find the review id from the shared tx
	var rev models.Review
	require.NoError(t, e.db.Where("content = ?", "Ожидает модерации отзыв.").First(&rev).Error)

	// admin approves
	adminCookies := e.login(t, "admin@test.ru", "Passw0rd")
	require.Equal(t, http.StatusOK,
		e.do("PUT", fmt.Sprintf("/api/admin/reviews/%d/approve", rev.ID), "", adminCookies).Code)

	// now public
	assert.Contains(t, e.do("GET", "/api/reviews", "", userCookies).Body.String(), "Ожидает модерации")
}
