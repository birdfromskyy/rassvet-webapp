package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// IPRateLimit ограничивает количество запросов с одного IP-адреса.
// maxReq — максимум запросов за window.
// Ключ в Redis: ratelimit:<path>:<ip>
func IPRateLimit(rdb *redis.Client, maxReq int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s:%s", c.FullPath(), ip)

		ctx := context.Background()
		count, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			// При ошибке Redis пропускаем — лучше деградировать, чем блокировать всех
			c.Next()
			return
		}
		if count == 1 {
			rdb.Expire(ctx, key, window)
		}
		if count > int64(maxReq) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Слишком много запросов. Попробуйте позже",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
