package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const maxAchievementBlocks = 100

type AchievementHandler struct{ db *gorm.DB }

func NewAchievementHandler(db *gorm.DB) *AchievementHandler {
	return &AchievementHandler{db: db}
}

type achievementBlockRequest struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Title   string `json:"title"`
}

type achievementRequest struct {
	ChildName  string                    `json:"child_name" binding:"required"`
	Conclusion string                    `json:"conclusion"`
	IsVisible  *bool                     `json:"is_visible"`
	SortOrder  int                       `json:"sort_order"`
	Blocks     []achievementBlockRequest `json:"blocks"`
}

type achievementListItem struct {
	ID              uint   `json:"id"`
	ChildName       string `json:"child_name"`
	Conclusion      string `json:"conclusion"`
	IsVisible       bool   `json:"is_visible"`
	SortOrder       int    `json:"sort_order"`
	PreviewImageURL string `json:"preview_image_url"`
	PreviewText     string `json:"preview_text"`
}

func legacyAchievementBlocks(item models.Achievement) []models.AchievementBlock {
	if len(item.Blocks) > 0 {
		return item.Blocks
	}

	blocks := make([]models.AchievementBlock, 0)
	appendBlock := func(blockType, content, title string) {
		content = strings.TrimSpace(content)
		if content == "" {
			return
		}
		blocks = append(blocks, models.AchievementBlock{
			AchievementID: item.ID,
			Type:          blockType,
			Content:       content,
			Title:         strings.TrimSpace(title),
			SortOrder:     len(blocks),
		})
	}

	appendBlock("image", item.ImageURL, item.ChildName)

	var paragraphs []string
	if err := json.Unmarshal([]byte(item.Description), &paragraphs); err != nil {
		paragraphs = strings.Split(strings.ReplaceAll(item.Description, "\r\n", "\n"), "\n")
	}
	for _, paragraph := range paragraphs {
		appendBlock("text", paragraph, "")
	}

	appendBlock("image", item.SecondImageURL, "")
	return blocks
}

func achievementListResponse(item models.Achievement) achievementListItem {
	blocks := legacyAchievementBlocks(item)
	result := achievementListItem{
		ID:         item.ID,
		ChildName:  item.ChildName,
		Conclusion: item.Conclusion,
		IsVisible:  item.IsVisible,
		SortOrder:  item.SortOrder,
	}
	for _, block := range blocks {
		if result.PreviewImageURL == "" && block.Type == "image" {
			result.PreviewImageURL = block.Content
		}
		if result.PreviewText == "" && block.Type == "text" {
			result.PreviewText = block.Content
		}
		if result.PreviewImageURL != "" && result.PreviewText != "" {
			break
		}
	}
	return result
}

func normalizeAchievementBlocks(requests []achievementBlockRequest) ([]models.AchievementBlock, error) {
	if len(requests) > maxAchievementBlocks {
		return nil, fmt.Errorf("в одной истории может быть не более %d блоков", maxAchievementBlocks)
	}

	blocks := make([]models.AchievementBlock, 0, len(requests))
	for _, request := range requests {
		blockType := strings.TrimSpace(request.Type)
		content := strings.TrimSpace(request.Content)
		if content == "" {
			continue
		}
		switch blockType {
		case "text":
		case "image":
			cleaned := path.Clean(content)
			filename := strings.TrimPrefix(cleaned, "/uploads/")
			if cleaned != content || filename == cleaned || filename == "" || strings.Contains(filename, "/") {
				return nil, fmt.Errorf("для фотографии укажите файл из папки загрузок")
			}
		case "video":
			parsed, err := url.ParseRequestURI(content)
			if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
				return nil, fmt.Errorf("для видео укажите корректную ссылку http или https")
			}
		default:
			return nil, fmt.Errorf("неподдерживаемый тип блока: %s", blockType)
		}
		blocks = append(blocks, models.AchievementBlock{
			Type:      blockType,
			Content:   content,
			Title:     strings.TrimSpace(request.Title),
			SortOrder: len(blocks),
		})
	}
	return blocks, nil
}

func replaceAchievementBlocks(tx *gorm.DB, achievementID uint, blocks []models.AchievementBlock) error {
	if err := tx.Where("achievement_id = ?", achievementID).Delete(&models.AchievementBlock{}).Error; err != nil {
		return err
	}
	for index := range blocks {
		blocks[index].AchievementID = achievementID
		blocks[index].SortOrder = index
		if err := tx.Create(&blocks[index]).Error; err != nil {
			return err
		}
	}
	return nil
}

func achievementImageURLs(item models.Achievement) map[string]struct{} {
	result := make(map[string]struct{})
	for _, block := range legacyAchievementBlocks(item) {
		if block.Type == "image" && block.Content != "" {
			result[block.Content] = struct{}{}
		}
	}
	return result
}

func loadAchievement(db *gorm.DB, id string, publicOnly bool) (models.Achievement, error) {
	var item models.Achievement
	query := db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") })
	if publicOnly {
		query = query.Where("is_visible = true")
	}
	err := query.First(&item, id).Error
	if err == nil {
		item.Blocks = legacyAchievementBlocks(item)
	}
	return item, err
}

// GetPublic returns a compact catalogue, not every story's complete text.
func (h *AchievementHandler) GetPublic(c *gin.Context) {
	var list []models.Achievement
	if err := h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }).
		Where("is_visible = true").Order("sort_order ASC, id ASC").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить истории"})
		return
	}
	result := make([]achievementListItem, 0, len(list))
	for _, item := range list {
		result = append(result, achievementListResponse(item))
	}
	c.JSON(http.StatusOK, result)
}

func (h *AchievementHandler) GetPublicByID(c *gin.Context) {
	item, err := loadAchievement(h.db, c.Param("id"), true)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "История не найдена"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *AchievementHandler) GetAll(c *gin.Context) {
	var list []models.Achievement
	if err := h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC, id ASC") }).
		Order("sort_order ASC, id ASC").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось загрузить истории"})
		return
	}
	result := make([]achievementListItem, 0, len(list))
	for _, item := range list {
		result = append(result, achievementListResponse(item))
	}
	c.JSON(http.StatusOK, result)
}

func (h *AchievementHandler) GetByID(c *gin.Context) {
	item, err := loadAchievement(h.db, c.Param("id"), false)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "История не найдена"})
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *AchievementHandler) Create(c *gin.Context) {
	var request achievementRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	request.ChildName = strings.TrimSpace(request.ChildName)
	if request.ChildName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите имя ребёнка"})
		return
	}
	blocks, err := normalizeAchievementBlocks(request.Blocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	isVisible := true
	if request.IsVisible != nil {
		isVisible = *request.IsVisible
	}
	item := models.Achievement{
		ChildName:  request.ChildName,
		Conclusion: strings.TrimSpace(request.Conclusion),
		IsVisible:  isVisible,
		SortOrder:  request.SortOrder,
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&item).Error; err != nil {
			return err
		}
		return replaceAchievementBlocks(tx, item.ID, blocks)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить историю"})
		return
	}
	item.Blocks = blocks
	c.JSON(http.StatusCreated, item)
}

func (h *AchievementHandler) Update(c *gin.Context) {
	original, err := loadAchievement(h.db, c.Param("id"), false)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "История не найдена"})
		return
	}
	var request achievementRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	request.ChildName = strings.TrimSpace(request.ChildName)
	if request.ChildName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Укажите имя ребёнка"})
		return
	}
	blocks, err := normalizeAchievementBlocks(request.Blocks)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	oldImages := achievementImageURLs(original)
	original.ChildName = request.ChildName
	original.Conclusion = strings.TrimSpace(request.Conclusion)
	original.SortOrder = request.SortOrder
	if request.IsVisible != nil {
		original.IsVisible = *request.IsVisible
	}
	original.ImageURL = ""
	original.SecondImageURL = ""
	original.Description = ""

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Achievement{}).Where("id = ?", original.ID).Updates(map[string]any{
			"child_name":       original.ChildName,
			"conclusion":       original.Conclusion,
			"is_visible":       original.IsVisible,
			"sort_order":       original.SortOrder,
			"image_url":        "",
			"second_image_url": "",
			"description":      "",
		}).Error; err != nil {
			return err
		}
		return replaceAchievementBlocks(tx, original.ID, blocks)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить историю"})
		return
	}

	newImages := make(map[string]struct{})
	for _, block := range blocks {
		if block.Type == "image" {
			newImages[block.Content] = struct{}{}
		}
	}
	for imageURL := range oldImages {
		if _, retained := newImages[imageURL]; !retained {
			deleteUploadFile(imageURL)
		}
	}
	original.Blocks = blocks
	c.JSON(http.StatusOK, original)
}

func (h *AchievementHandler) Delete(c *gin.Context) {
	item, err := loadAchievement(h.db, c.Param("id"), false)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "История не найдена"})
		return
	}
	images := achievementImageURLs(item)
	if err := h.db.Unscoped().Delete(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось удалить историю"})
		return
	}
	for imageURL := range images {
		deleteUploadFile(imageURL)
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
