package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// luaRateLimit atomically increments the counter and sets TTL on first increment.
// Returns the current count after increment.
var luaRateLimit = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`)

// IPRateLimit ограничивает количество запросов с одного IP-адреса.
// maxReq — максимум запросов за window.
// Ключ в Redis: ratelimit:<path>:<ip>
func IPRateLimit(rdb *redis.Client, maxReq int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("ratelimit:%s:%s", c.FullPath(), ip)

		ctx := context.Background()
		result, err := luaRateLimit.Run(ctx, rdb, []string{key}, int(window.Seconds())).Int64()
		if err != nil {
			// При ошибке Redis пропускаем — лучше деградировать, чем блокировать всех
			c.Next()
			return
		}
		if result > int64(maxReq) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Слишком много запросов. Попробуйте позже",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
