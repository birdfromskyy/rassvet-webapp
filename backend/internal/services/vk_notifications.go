package services

import (
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"gorm.io/gorm"
)

const defaultVKAPIBaseURL = "https://api.vk.com/method/"

type VKNotificationService struct {
	db          *gorm.DB
	token       string
	apiVersion  string
	frontendURL string
	apiBaseURL  string
	client      *http.Client
	queue       chan uint
}

type vkAPIError struct {
	Code    int    `json:"error_code"`
	Message string `json:"error_msg"`
}

type vkAPIEnvelope struct {
	Response json.RawMessage `json:"response"`
	Error    *vkAPIError     `json:"error"`
}

func NewVKNotificationService(db *gorm.DB, token, apiVersion, frontendURL string) *VKNotificationService {
	service := &VKNotificationService{
		db:          db,
		token:       strings.TrimSpace(token),
		apiVersion:  strings.TrimSpace(apiVersion),
		frontendURL: strings.TrimRight(strings.TrimSpace(frontendURL), "/"),
		apiBaseURL:  defaultVKAPIBaseURL,
		client:      &http.Client{Timeout: 10 * time.Second},
		queue:       make(chan uint, 100),
	}
	if service.apiVersion == "" {
		service.apiVersion = "5.199"
	}
	if service.Configured() {
		go service.runQueue()
	}
	return service
}

func (s *VKNotificationService) Configured() bool {
	return s != nil && s.token != ""
}

// QueueAdminNotification schedules one already-created in-app notification for
// VK delivery. The database ID is used as VK random_id, so an accidental retry
// cannot create a duplicate message in the same conversation.
func (s *VKNotificationService) QueueAdminNotification(notificationID uint) {
	if !s.Configured() || notificationID == 0 {
		return
	}
	select {
	case s.queue <- notificationID:
	default:
		log.Printf("[VK-NOTIFICATION] event=queue_full notification_id=%d", notificationID)
	}
}

func (s *VKNotificationService) runQueue() {
	for notificationID := range s.queue {
		notification, err := s.waitForNotification(notificationID)
		if err != nil {
			log.Printf("[VK-NOTIFICATION] event=notification_not_found notification_id=%d", notificationID)
			continue
		}
		sent, failed := s.sendToEnabledRecipients(notification.ID, notification.Title, notification.Body, notification.Link)
		log.Printf("[VK-NOTIFICATION] event=admin_notification notification_id=%d sent=%d failed=%d", notification.ID, sent, failed)
	}
}

// waitForNotification also covers calls made inside a GORM transaction: the
// worker waits briefly until the inserted notification becomes visible after
// commit and skips delivery if the transaction was rolled back.
func (s *VKNotificationService) waitForNotification(id uint) (models.Notification, error) {
	delays := []time.Duration{0, 50 * time.Millisecond, 100 * time.Millisecond, 200 * time.Millisecond, 400 * time.Millisecond, 800 * time.Millisecond}
	for _, delay := range delays {
		if delay > 0 {
			time.Sleep(delay)
		}
		var notification models.Notification
		if err := s.db.First(&notification, id).Error; err == nil {
			return notification, nil
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Notification{}, err
		}
	}
	return models.Notification{}, gorm.ErrRecordNotFound
}

func (s *VKNotificationService) SendTest(ctx context.Context, recipient models.VKNotificationRecipient) error {
	if !s.Configured() {
		return errors.New("доставка уведомлений в VK временно недоступна")
	}
	if !recipient.IsEnabled {
		return errors.New("доставка этому получателю отключена")
	}
	message := "Тестовое уведомление\n\nИнтеграция уведомлений Центра «РАСсвет» с VK работает корректно."
	return s.sendMessage(ctx, recipient.VKUserID, message, secureRandomID())
}

func (s *VKNotificationService) ResolveUserID(ctx context.Context, profileURL string) (int64, error) {
	identifier, err := parseVKProfileIdentifier(profileURL)
	if err != nil {
		return 0, err
	}
	if strings.HasPrefix(identifier, "id") {
		id, parseErr := strconv.ParseInt(strings.TrimPrefix(identifier, "id"), 10, 64)
		if parseErr == nil && id > 0 {
			return id, nil
		}
	}
	if !s.Configured() {
		return 0, errors.New("не удалось проверить короткую ссылку VK")
	}

	params := url.Values{"user_ids": {identifier}}
	var users []struct {
		ID int64 `json:"id"`
	}
	if err := s.call(ctx, "users.get", params, &users); err != nil {
		return 0, fmt.Errorf("не удалось проверить страницу VK: %w", err)
	}
	if len(users) != 1 || users[0].ID <= 0 {
		return 0, errors.New("пользователь VK не найден")
	}
	return users[0].ID, nil
}

func parseVKProfileIdentifier(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", errors.New("укажите ссылку на страницу VK")
	}
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Port() != "" {
		return "", errors.New("укажите корректную HTTPS-ссылку на страницу VK")
	}
	host := strings.ToLower(parsed.Hostname())
	if !isVKProfileHost(host) {
		return "", errors.New("разрешены только ссылки vk.com и vk.ru")
	}
	identifier := strings.Trim(strings.TrimSpace(parsed.Path), "/")
	if identifier == "" || strings.Contains(identifier, "/") {
		return "", errors.New("укажите ссылку непосредственно на страницу пользователя VK")
	}
	return identifier, nil
}

func isVKProfileHost(host string) bool {
	return host == "vk.com" || host == "vk.ru" || host == "m.vk.com" || host == "m.vk.ru"
}

func (s *VKNotificationService) sendToEnabledRecipients(notificationID uint, title, body, link string) (int, int) {
	if !s.Configured() {
		return 0, 0
	}
	var recipients []models.VKNotificationRecipient
	if err := s.db.Where("is_enabled = true").Order("id ASC").Find(&recipients).Error; err != nil {
		log.Printf("[VK-NOTIFICATION] event=load_recipients_failed error=%q", err.Error())
		return 0, 1
	}
	message := buildVKNotificationMessage(title, body, link, s.frontendURL)
	sent, failed := 0, 0
	for _, recipient := range recipients {
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		err := s.sendMessage(ctx, recipient.VKUserID, message, notificationRandomID(notificationID, recipient.VKUserID))
		cancel()
		if err != nil {
			failed++
			log.Printf("[VK-NOTIFICATION] event=delivery_failed recipient_id=%d vk_user_id=%d error=%q", recipient.ID, recipient.VKUserID, err.Error())
			continue
		}
		sent++
	}
	return sent, failed
}

func buildVKNotificationMessage(title, body, link, frontendURL string) string {
	parts := make([]string, 0, 3)
	if value := strings.TrimSpace(title); value != "" {
		parts = append(parts, "🔔 "+value)
	}
	if value := strings.TrimSpace(body); value != "" {
		parts = append(parts, value)
	}
	if value := strings.TrimSpace(link); value != "" {
		if strings.HasPrefix(value, "/") && frontendURL != "" {
			value = frontendURL + value
		}
		parts = append(parts, value)
	}
	return strings.Join(parts, "\n\n")
}

func (s *VKNotificationService) sendMessage(ctx context.Context, userID int64, message string, randomID int64) error {
	params := url.Values{
		"user_id":   {strconv.FormatInt(userID, 10)},
		"random_id": {strconv.FormatInt(randomID, 10)},
		"message":   {message},
	}
	var response int64
	return s.call(ctx, "messages.send", params, &response)
}

func (s *VKNotificationService) call(ctx context.Context, method string, params url.Values, target any) error {
	if !s.Configured() {
		return errors.New("доставка уведомлений в VK временно недоступна")
	}
	params.Set("access_token", s.token)
	params.Set("v", s.apiVersion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.apiBaseURL+method, strings.NewReader(params.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "RassvetNotificationService/1.0")

	response, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("VK API вернул HTTP %d", response.StatusCode)
	}
	var envelope vkAPIEnvelope
	if err := json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		return errors.New("VK API вернул некорректный ответ")
	}
	if envelope.Error != nil {
		return fmt.Errorf("VK API: %s (код %d)", envelope.Error.Message, envelope.Error.Code)
	}
	if target != nil && len(envelope.Response) > 0 {
		if err := json.Unmarshal(envelope.Response, target); err != nil {
			return errors.New("не удалось прочитать ответ VK API")
		}
	}
	return nil
}

func notificationRandomID(notificationID uint, vkUserID int64) int64 {
	const maxVKRandomID = uint64(2147483647)
	// Include the conversation in the deterministic id. VK can then deduplicate
	// retries for one recipient without treating deliveries to two people as the
	// same outgoing message.
	mixed := (uint64(notificationID)*1000003 ^ uint64(vkUserID)) % maxVKRandomID
	value := int64(mixed)
	if value == 0 {
		return 1
	}
	return value
}

func secureRandomID() int64 {
	var bytes [4]byte
	if _, err := rand.Read(bytes[:]); err == nil {
		value := int64(binary.BigEndian.Uint32(bytes[:]) & 0x7fffffff)
		if value > 0 {
			return value
		}
	}
	return time.Now().UnixNano() & 0x7fffffff
}
