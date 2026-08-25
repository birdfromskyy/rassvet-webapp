package handlers

import (
	"backend/internal/models"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ArticleHandler struct {
	db *gorm.DB
}

func NewArticleHandler(db *gorm.DB) *ArticleHandler {
	return &ArticleHandler{db: db}
}

type BlockRequest struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	Title     string `json:"title"`
	SortOrder int    `json:"sort_order"`
}

type ArticleRequest struct {
	Title         string         `json:"title" binding:"required"`
	Slug          string         `json:"slug" binding:"required"`
	Summary       string         `json:"summary"`
	FeaturedImage string         `json:"featured_image"`
	Status        string         `json:"status"` // draft | published
	PublishedAt   string         `json:"published_at"`
	Blocks        []BlockRequest `json:"blocks"`
}

type ArticlePublicationRequest struct {
	Status string `json:"status" binding:"required,oneof=draft published"`
}

func parseArticlePublishedAt(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, fmt.Errorf("дата публикации должна быть в формате ГГГГ-ММ-ДД")
	}
	// Midday UTC retains the selected calendar date for all Russian time zones
	// when the client later formats the existing time.Time value.
	date = time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, time.UTC)
	return &date, nil
}

func validateArticleStatus(status string) error {
	if status != "" && status != "draft" && status != "published" {
		return fmt.Errorf("некорректный статус новости")
	}
	return nil
}

func saveArticleBlocks(tx *gorm.DB, articleID uint, blocks []BlockRequest) error {
	if err := tx.Where("article_id = ?", articleID).Delete(&models.ArticleBlock{}).Error; err != nil {
		return err
	}
	for i, b := range blocks {
		block := models.ArticleBlock{
			ArticleID: articleID,
			Type:      b.Type,
			Content:   b.Content,
			Title:     b.Title,
			SortOrder: i,
		}
		if err := tx.Create(&block).Error; err != nil {
			return err
		}
	}
	return nil
}

// GetArticles — public endpoint, only published articles with pagination.
func (h *ArticleHandler) GetArticles(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "9"))
	if limit > 50 {
		limit = 50
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	query := h.db.Model(&models.Article{}).Where("status = ?", "published")

	if search := c.Query("search"); search != "" {
		like := "%" + search + "%"
		query = query.Where("title ILIKE ? OR summary ILIKE ?", like, like)
	}
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	var total int64
	query.Count(&total)

	var articles []models.Article
	query.Order("published_at DESC, created_at DESC").Limit(limit).Offset(offset).Find(&articles)

	c.JSON(http.StatusOK, gin.H{
		"articles": articles,
		"pagination": gin.H{
			"total": total,
			"pages": (total + int64(limit) - 1) / int64(limit),
			"page":  page,
			"limit": limit,
		},
	})
}

// GetArticleBySlug — public endpoint, returns article with blocks.
func (h *ArticleHandler) GetArticleBySlug(c *gin.Context) {
	slug := c.Param("slug")
	var article models.Article
	if err := h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("slug = ? AND status = ?", slug, "published").First(&article).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Статья не найдена"})
		return
	}
	c.JSON(http.StatusOK, article)
}

// GetCategories — public endpoint, distinct categories.
func (h *ArticleHandler) GetCategories(c *gin.Context) {
	var categories []string
	h.db.Model(&models.Article{}).
		Where("status = ? AND category != ''", "published").
		Distinct("category").
		Pluck("category", &categories)
	c.JSON(http.StatusOK, categories)
}

// Admin endpoints

func (h *ArticleHandler) GetAllArticles(c *gin.Context) {
	var articles []models.Article
	h.db.Order("published_at DESC NULLS LAST, created_at DESC").Find(&articles)
	c.JSON(http.StatusOK, articles)
}

func (h *ArticleHandler) GetArticleByID(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Статья не найдена"})
		return
	}
	c.JSON(http.StatusOK, article)
}

func (h *ArticleHandler) CreateArticle(c *gin.Context) {
	var req ArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateArticleStatus(req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	publishedAt, err := parseArticlePublishedAt(req.PublishedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug uniqueness
	var count int64
	h.db.Model(&models.Article{}).Where("slug = ?", req.Slug).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "URL-адрес (slug) уже занят другой статьёй"})
		return
	}

	article := models.Article{
		Title:         req.Title,
		Slug:          req.Slug,
		Summary:       req.Summary,
		FeaturedImage: req.FeaturedImage,
		Status:        req.Status,
		PublishedAt:   publishedAt,
	}
	if article.Status == "" {
		article.Status = "draft"
	}
	if article.PublishedAt == nil {
		now := time.Now()
		article.PublishedAt = &now
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&article).Error; err != nil {
			return err
		}
		return saveArticleBlocks(tx, article.ID, req.Blocks)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).First(&article, article.ID)
	c.JSON(http.StatusCreated, article)
}

func (h *ArticleHandler) UpdateArticle(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := h.db.First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Статья не найдена"})
		return
	}

	var req ArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateArticleStatus(req.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	publishedAt, err := parseArticlePublishedAt(req.PublishedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug uniqueness (excluding self)
	var count int64
	h.db.Model(&models.Article{}).Where("slug = ? AND id != ?", req.Slug, article.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "URL-адрес (slug) уже занят другой статьёй"})
		return
	}

	article.Title = req.Title
	article.Slug = req.Slug
	article.Summary = req.Summary
	article.FeaturedImage = req.FeaturedImage
	if publishedAt != nil {
		article.PublishedAt = publishedAt
	} else if article.PublishedAt == nil {
		now := time.Now()
		article.PublishedAt = &now
	}
	if req.Status != "" {
		article.Status = req.Status
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&article).Error; err != nil {
			return err
		}
		return saveArticleBlocks(tx, article.ID, req.Blocks)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).First(&article, article.ID)
	c.JSON(http.StatusOK, article)
}

// SetPublicationStatus changes only status. It deliberately does not call
// saveBlocks, so the list-page switch cannot overwrite article content.
func (h *ArticleHandler) SetPublicationStatus(c *gin.Context) {
	var article models.Article
	if err := h.db.First(&article, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Статья не найдена"})
		return
	}
	var req ArticlePublicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	article.Status = req.Status
	if article.PublishedAt == nil {
		now := time.Now()
		article.PublishedAt = &now
	}
	if err := h.db.Save(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, article)
}

func (h *ArticleHandler) DeleteArticle(c *gin.Context) {
	id := c.Param("id")

	// Load article with blocks to collect file URLs before deletion
	var article models.Article
	if err := h.db.Preload("Blocks").First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Статья не найдена"})
		return
	}

	if err := h.db.Delete(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clean up uploaded files after successful DB deletion
	deleteUploadFile(article.FeaturedImage)
	for _, block := range article.Blocks {
		if block.Type == "image" || block.Type == "file" {
			deleteUploadFile(block.Content)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
