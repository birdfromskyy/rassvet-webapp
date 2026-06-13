package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders adds HTTP security headers to every response.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("X-XSS-Protection", "0")
		// Разрешаем inline-стили и скрипты для React+MUI, внешние изображения (CMS-uploads).
		// unsafe-inline нужен для MUI Emotion (CSS-in-JS) и React Quill.
		c.Header("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'unsafe-inline'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: blob: https:; "+
				"font-src 'self' data: https:; "+
				"media-src 'self' https:; "+
				"connect-src 'self'; "+
				"frame-src https://vk.com https://*.vk.com https://yandex.ru https://*.yandex.ru; "+
				"frame-ancestors 'none'")
		c.Next()
	}
}
