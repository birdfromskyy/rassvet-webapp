package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ClientErrorHandler struct{}

func NewClientErrorHandler() *ClientErrorHandler {
	return &ClientErrorHandler{}
}

type clientErrorRequest struct {
	Message string `json:"message" binding:"required,max=2000"`
	Stack   string `json:"stack" binding:"max=4000"`
	URL     string `json:"url" binding:"max=500"`
}

// POST /api/client-error — public, rate-limited.
// Reports a JS error/crash from the browser. Logged only (no DB write) —
// look for "[CLIENT-ERROR]" in backend logs.
func (h *ClientErrorHandler) Report(c *gin.Context) {
	var req clientErrorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Некорректные данные"})
		return
	}

	stack := strings.ReplaceAll(strings.TrimSpace(req.Stack), "\n", " | ")
	ua := c.Request.UserAgent()

	log.Printf("[CLIENT-ERROR] ip=%s url=%s message=%s ua=%s stack=%s",
		c.ClientIP(), req.URL, req.Message, ua, stack)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
