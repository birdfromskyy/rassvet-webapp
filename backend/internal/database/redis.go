package database

import (
	"backend/internal/config"
	"context"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9"
)

func InitializeRedis(cfg *config.Config) (*redis.Client, error) {
	dbNum, err := strconv.Atoi(cfg.RedisDB)
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_DB: %w", err)
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
		DB:       dbNum,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return rdb, nil
}
