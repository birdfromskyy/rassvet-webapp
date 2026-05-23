package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
