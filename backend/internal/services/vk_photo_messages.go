package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type vkMessagePhotoUploadServer struct {
	UploadURL string `json:"upload_url"`
}

type vkMessagePhotoUploadResult struct {
	Server int64  `json:"server"`
	Photo  string `json:"photo"`
	Hash   string `json:"hash"`
	Error  string `json:"error"`
}

type vkSavedMessagePhoto struct {
	OwnerID int64 `json:"owner_id"`
	ID      int64 `json:"id"`
}

// sendPNGPhoto sends a photo attachment in a private VK message. It never
// calls wall or album methods, and intentionally has no delete operation.
func (s *VKNotificationService) sendPNGPhoto(ctx context.Context, userID int64, imageBytes []byte, message string, randomID int64) error {
	if len(imageBytes) == 0 {
		return fmt.Errorf("пустое изображение расписания")
	}
	var uploadServer vkMessagePhotoUploadServer
	if err := s.call(ctx, "photos.getMessagesUploadServer", url.Values{
		"peer_id": {strconv.FormatInt(userID, 10)},
	}, &uploadServer); err != nil {
		return err
	}
	if uploadServer.UploadURL == "" {
		return fmt.Errorf("VK не вернул адрес загрузки фотографии")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("photo", "schedule.png")
	if err != nil {
		return fmt.Errorf("подготовить фотографию расписания: %w", err)
	}
	if _, err = part.Write(imageBytes); err != nil {
		return fmt.Errorf("записать фотографию расписания: %w", err)
	}
	if err = writer.Close(); err != nil {
		return fmt.Errorf("завершить фотографию расписания: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadServer.UploadURL, &body)
	if err != nil {
		return fmt.Errorf("создать запрос загрузки фотографии: %w", err)
	}
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set("User-Agent", "RassvetNotificationService/1.0")
	response, err := s.client.Do(request)
	if err != nil {
		return fmt.Errorf("загрузить фотографию расписания: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("сервер загрузки VK вернул HTTP %d", response.StatusCode)
	}
	payload, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return fmt.Errorf("прочитать ответ загрузки VK: %w", err)
	}
	var uploaded vkMessagePhotoUploadResult
	if err := json.Unmarshal(payload, &uploaded); err != nil {
		return fmt.Errorf("прочитать ответ загрузки VK: %w", err)
	}
	if uploaded.Server == 0 || uploaded.Photo == "" || uploaded.Hash == "" {
		if message := strings.TrimSpace(uploaded.Error); message != "" {
			return fmt.Errorf("VK отклонил загрузку фотографии: %s", truncateVKUploadError(message))
		}
		return fmt.Errorf("VK вернул неполный ответ о загруженной фотографии")
	}

	var saved []vkSavedMessagePhoto
	if err := s.call(ctx, "photos.saveMessagesPhoto", url.Values{
		"server": {strconv.FormatInt(uploaded.Server, 10)},
		"photo":  {uploaded.Photo},
		"hash":   {uploaded.Hash},
	}, &saved); err != nil {
		return err
	}
	if len(saved) != 1 || saved[0].ID == 0 || saved[0].OwnerID == 0 {
		return fmt.Errorf("VK не сохранил фотографию сообщения")
	}

	var sent int64
	if err := s.call(ctx, "messages.send", url.Values{
		"user_id":    {strconv.FormatInt(userID, 10)},
		"random_id":  {strconv.FormatInt(randomID, 10)},
		"attachment": {fmt.Sprintf("photo%d_%d", saved[0].OwnerID, saved[0].ID)},
		"message":    {message},
	}, &sent); err != nil {
		return err
	}
	return nil
}

func truncateVKUploadError(value string) string {
	const maxRunes = 300
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= maxRunes {
		return string(runes)
	}
	return string(runes[:maxRunes]) + "…"
}
