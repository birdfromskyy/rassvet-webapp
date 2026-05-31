package middleware

import (
	"backend/internal/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Cookie takes priority (browser); Authorization header as fallback (API/mobile clients)
		tokenString, _ := c.Cookie("token")
		if tokenString == "" {
			tokenString = strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		}
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Требуется авторизация"})
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Недействительный токен"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// AdminMiddleware allows both "admin" and "superadmin".
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" && role != "superadmin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ запрещён"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// SuperAdminMiddleware allows only "superadmin".
func SuperAdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "superadmin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Доступ только для суперадминистратора"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// IsSuperAdmin returns true if the current request is made by a superadmin.
func IsSuperAdmin(c *gin.Context) bool {
	role, _ := c.Get("role")
	return role == "superadmin"
}
