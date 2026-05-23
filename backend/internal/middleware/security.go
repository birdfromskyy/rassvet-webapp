package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders adds HTTP security headers to every response.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Запрещает встраивать страницы в iframe (защита от clickjacking)
		c.Header("X-Frame-Options", "DENY")
		// Запрещает браузеру угадывать MIME-тип файла
		c.Header("X-Content-Type-Options", "nosniff")
		// Контролирует, сколько информации о реферере передаётся
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		// Отключаем устаревший XSS-фильтр браузера (в современных браузерах он
		// может создавать уязвимости, а не защищать от них)
		c.Header("X-XSS-Protection", "0")
		c.Next()
	}
}
