COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

.DEFAULT_GOAL := help

.PHONY: help up up-d build down restart ps logs logs-backend logs-frontend test test-backend build-frontend

help: ## Показать доступные команды
	@awk 'BEGIN {FS = ":.*##"}; /^[a-zA-Z_-]+:.*##/ {printf "%-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## Собрать и запустить локальный стек
	$(COMPOSE_DEV) up --build

up-d: ## Собрать и запустить локальный стек в фоне
	$(COMPOSE_DEV) up -d --build

build: ## Пересобрать образы локального стека
	$(COMPOSE_DEV) build

down: ## Остановить локальный стек, не удаляя данные
	$(COMPOSE_DEV) down

restart: ## Перезапустить локальные контейнеры
	$(COMPOSE_DEV) restart

ps: ## Показать состояние локальных контейнеров
	$(COMPOSE_DEV) ps

logs: ## Следить за логами всех локальных сервисов
	$(COMPOSE_DEV) logs -f

logs-backend: ## Следить за логами backend
	$(COMPOSE_DEV) logs -f backend

logs-frontend: ## Следить за логами frontend
	$(COMPOSE_DEV) logs -f frontend

test: test-backend build-frontend ## Запустить основные проверки

test-backend: ## Запустить Go-тесты
	cd backend && go test ./...

build-frontend: ## Собрать production-версию frontend
	cd frontend && npm run build
