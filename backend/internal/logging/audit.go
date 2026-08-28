package logging

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// AdminMutation writes a durable-in-Docker, human-readable audit record for a
// successful administrative change. Sensitive fields (passwords, tokens and
// document contents) must be excluded by the caller's snapshot.
func AdminMutation(c *gin.Context, event string, before, after any) {
	actorID, actorRole := actor(c)
	log.Printf("[ADMIN-AUDIT] event=%s actor_id=%s actor_role=%s remote_ip=%s route=%s\n%s",
		event, actorID, actorRole, clientIP(c), route(c), mutationSummary(before, after))
}

// Event is for compact, aggregate operational events such as schedule
// generation. It deliberately has no IP: it is used for product diagnostics,
// not network forensics.
func Event(event string, fields map[string]any) {
	encoded, err := json.Marshal(fields)
	if err != nil {
		encoded = []byte(`{"log_error":"cannot encode fields"}`)
	}
	log.Printf("[EVENT] event=%s fields=%s", event, encoded)
}

func actor(c *gin.Context) (string, string) {
	if c == nil {
		return "anonymous", "anonymous"
	}
	userID, hasUser := c.Get("userID")
	role, _ := c.Get("role")
	if !hasUser {
		return "anonymous", "anonymous"
	}
	return fmt.Sprint(userID), fmt.Sprint(role)
}

func route(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return "unknown"
	}
	if fullPath := c.FullPath(); fullPath != "" {
		return fullPath
	}
	return c.Request.URL.Path
}

func clientIP(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return "unknown"
	}
	return c.ClientIP()
}

func mutationSummary(before, after any) string {
	if before == nil {
		return "created=" + prettyJSON(after)
	}
	if after == nil {
		return "deleted=" + prettyJSON(before)
	}

	beforeFields := snapshotFields(before)
	afterFields := snapshotFields(after)
	changes := make(map[string]map[string]any)
	for key, beforeValue := range beforeFields {
		afterValue, exists := afterFields[key]
		if !exists || !valuesEqual(beforeValue, afterValue) {
			changes[key] = map[string]any{"before": beforeValue, "after": afterValue}
		}
	}
	for key, afterValue := range afterFields {
		if _, exists := beforeFields[key]; !exists {
			changes[key] = map[string]any{"before": nil, "after": afterValue}
		}
	}
	return "changes=" + prettyJSON(changes)
}

func snapshotFields(value any) map[string]any {
	encoded, err := json.Marshal(value)
	if err != nil {
		return map[string]any{"log_error": err.Error()}
	}
	fields := make(map[string]any)
	if err := json.Unmarshal(encoded, &fields); err != nil {
		return map[string]any{"value": string(encoded)}
	}
	return fields
}

func valuesEqual(left, right any) bool {
	leftJSON, leftErr := json.Marshal(left)
	rightJSON, rightErr := json.Marshal(right)
	return leftErr == nil && rightErr == nil && bytes.Equal(leftJSON, rightJSON)
}

func prettyJSON(value any) string {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Sprintf(`{"log_error":%q}`, err.Error())
	}
	return string(encoded)
}

// AccessLog emits one compact record for every API request. Context values are
// read after handlers have run, so authenticated requests include the JWT actor
// without any extra database query.
func AccessLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()

		status := c.Writer.Status()
		path := c.Request.URL.Path
		if skipAccessLog(c.Request.Method, path, status) {
			return
		}

		actorID, actorRole := actor(c)
		remoteIP := ""
		if isAdminMutation(c.Request.Method, route(c)) {
			remoteIP = " remote_ip=" + c.ClientIP()
		}
		log.Printf("[HTTP] actor_id=%s actor_role=%s method=%s route=%s status=%d duration_ms=%d%s",
			actorID, actorRole, c.Request.Method, route(c), status,
			time.Since(startedAt).Milliseconds(), remoteIP)
	}
}

func skipAccessLog(method, path string, status int) bool {
	// CORS preflight carries no session cookie or authorization header, so it
	// cannot truthfully identify an actor. Successful preflights are transport
	// noise; failed ones remain visible.
	if method == "OPTIONS" && status < 400 {
		return true
	}
	if status < 400 {
		switch path {
		case "/api/health", "/api/refresh":
			return true
		case "/api/notifications/unread-count", "/api/admin/support/unread-count":
			// These counters are refreshed in the background. Logging every
			// successful poll obscures meaningful user actions, while failed
			// requests above remain visible.
			return true
		}
	}
	return false
}

func isAdminMutation(method, route string) bool {
	if len(route) < len("/api/admin/") || route[:len("/api/admin/")] != "/api/admin/" {
		return false
	}
	return method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE"
}
