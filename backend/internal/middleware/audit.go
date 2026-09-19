package middleware

import (
	"log"

	"github.com/gin-gonic/gin"
)

// AuditLog records, for every AUTHENTICATED request, one of:
//   - a completed change     → [AUDIT]    (who changed what, where, on what device)
//   - any error response     → [USER-ERR] (which user hit which error, where, device)
//
// Read-only successful requests (GET 200) are skipped to keep the volume sane.
// It reads the user from the context set by AuthMiddleware, so mount it AFTER
// AuthMiddleware. No DB calls — cheap.
func AuditLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		status := c.Writer.Status()
		method := c.Request.Method
		mutation := method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE"

		// 401 is almost always the routine "access token expired → silent
		// refresh → retry" cycle, not a real problem — skip it to avoid flooding.
		if status == 401 {
			return
		}
		// Otherwise log errors, and successful mutations; skip successful reads.
		if status < 400 && !mutation {
			return
		}

		uid, _ := c.Get("userID")
		role, _ := c.Get("role")

		tag := "[AUDIT]"
		if status >= 400 {
			tag = "[USER-ERR]"
		}

		log.Printf("%s user=%v role=%v ip=%s ua=%q %s %s status=%d",
			tag, uid, role, c.ClientIP(), c.Request.UserAgent(),
			method, c.Request.URL.Path, status)
	}
}
