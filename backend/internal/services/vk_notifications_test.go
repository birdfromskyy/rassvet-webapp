package services

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseVKProfileIdentifier(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		expected  string
		wantError bool
	}{
		{name: "vk com numeric", value: "https://vk.com/id123", expected: "id123"},
		{name: "vk ru screen name", value: "vk.ru/test_admin", expected: "test_admin"},
		{name: "mobile host", value: "https://m.vk.com/id42", expected: "id42"},
		{name: "http rejected", value: "http://vk.com/id1", wantError: true},
		{name: "foreign host rejected", value: "https://example.com/id1", wantError: true},
		{name: "nested path rejected", value: "https://vk.com/id1/photos", wantError: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := parseVKProfileIdentifier(test.value)
			if test.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.expected, actual)
		})
	}
}

func TestVKSendMessageUsesOnlyMessagesSend(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, "/messages.send", r.URL.Path)
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		form, err := url.ParseQuery(string(body))
		require.NoError(t, err)
		require.Equal(t, "secret-token", form.Get("access_token"))
		require.Equal(t, "123", form.Get("user_id"))
		require.Equal(t, "Тест", form.Get("message"))
		require.Equal(t, "77", form.Get("random_id"))
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"response":55}`)),
			Header:     make(http.Header),
		}, nil
	})}

	service := &VKNotificationService{
		token:      "secret-token",
		apiVersion: "5.199",
		apiBaseURL: "https://api.vk.test/",
		client:     client,
	}
	require.NoError(t, service.sendMessage(context.Background(), 123, "Тест", 77))
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func TestBuildVKNotificationMessage(t *testing.T) {
	message := buildVKNotificationMessage("Новая заявка", "Проверьте документы", "/admin/documents", "https://rassvethm.ru")
	require.Equal(t, "🔔 Новая заявка\n\nПроверьте документы\n\nhttps://rassvethm.ru/admin/documents", message)
}

func TestNotificationRandomIDIsStableAndRecipientSpecific(t *testing.T) {
	require.Equal(t, notificationRandomID(15, 100), notificationRandomID(15, 100))
	require.NotEqual(t, notificationRandomID(15, 100), notificationRandomID(15, 101))
}
