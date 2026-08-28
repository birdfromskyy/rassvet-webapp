package logging

import "testing"

func TestSkipAccessLog(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		status int
		want   bool
	}{
		{name: "successful preflight", method: "OPTIONS", path: "/api/me", status: 204, want: true},
		{name: "successful health check", method: "GET", path: "/api/health", status: 200, want: true},
		{name: "successful token refresh", method: "POST", path: "/api/refresh", status: 200, want: true},
		{name: "successful notification counter poll", method: "GET", path: "/api/notifications/unread-count", status: 200, want: true},
		{name: "successful support counter poll", method: "GET", path: "/api/admin/support/unread-count", status: 200, want: true},
		{name: "failed notification counter poll", method: "GET", path: "/api/notifications/unread-count", status: 500, want: false},
		{name: "ordinary request", method: "GET", path: "/api/notifications", status: 200, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := skipAccessLog(tt.method, tt.path, tt.status); got != tt.want {
				t.Fatalf("skipAccessLog(%q, %q, %d) = %t, want %t", tt.method, tt.path, tt.status, got, tt.want)
			}
		})
	}
}
