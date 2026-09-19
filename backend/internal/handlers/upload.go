package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gabriel-vasile/mimetype"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const uploadsDir = "./uploads"

const maxUploadSize = 20 * 1024 * 1024 // 20 MB

var allowedUploadExts = map[string]bool{
	".pdf":  true,
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".doc":  true,
	".docx": true,
	".xls":  true,
	".xlsx": true,
	".txt":  true,
	".mp4":  true,
}

var allowedUploadMIMEs = map[string]bool{
	"application/pdf":   true,
	"image/jpeg":        true,
	"image/png":         true,
	"image/gif":         true,
	"image/webp":        true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel":                                                true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       true,
	"text/plain": true,
	"video/mp4":  true,
}

func UploadFile(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Файл обязателен для загрузки"})
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Файл превышает 20 МБ"})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedUploadExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("формат «%s» не разрешён", ext)})
		return
	}

	mtype, err := mimetype.DetectReader(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Не удалось определить тип файла"})
		return
	}
	mimeBase := strings.ToLower(strings.SplitN(mtype.String(), ";", 2)[0])
	if !allowedUploadMIMEs[strings.TrimSpace(mimeBase)] {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("содержимое файла не соответствует расширению «%s»", ext)})
		return
	}

	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Внутренняя ошибка сервера"})
		return
	}

	filename := uuid.New().String() + ext
	savePath := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(header, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить файл"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      fmt.Sprintf("/uploads/%s", filename),
		"filename": header.Filename,
	})
}
