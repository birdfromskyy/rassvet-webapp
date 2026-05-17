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

func UploadFile(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create uploads directory"})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	filename := uuid.New().String() + ext
	savePath := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(header, savePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      fmt.Sprintf("/uploads/%s", filename),
		"filename": header.Filename,
	})
}
