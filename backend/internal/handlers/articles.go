package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
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
	Category      string         `json:"category"`
	Tags          string         `json:"tags"`
	FeaturedImage string         `json:"featured_image"`
	Status        string         `json:"status"` // draft | published
	Blocks        []BlockRequest `json:"blocks"`
}

func (h *ArticleHandler) saveBlocks(articleID uint, blocks []BlockRequest) error {
	if err := h.db.Where("article_id = ?", articleID).Delete(&models.ArticleBlock{}).Error; err != nil {
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
		if err := h.db.Create(&block).Error; err != nil {
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
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
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
	h.db.Order("created_at DESC").Find(&articles)
	c.JSON(http.StatusOK, articles)
}

func (h *ArticleHandler) GetArticleByID(c *gin.Context) {
	id := c.Param("id")
	var article models.Article
	if err := h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).First(&article, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
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

	// Check slug uniqueness
	var count int64
	h.db.Model(&models.Article{}).Where("slug = ?", req.Slug).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already exists"})
		return
	}

	article := models.Article{
		Title:         req.Title,
		Slug:          req.Slug,
		Summary:       req.Summary,
		Category:      req.Category,
		Tags:          req.Tags,
		FeaturedImage: req.FeaturedImage,
		Status:        req.Status,
	}
	if article.Status == "" {
		article.Status = "draft"
	}
	if article.Status == "published" {
		now := time.Now()
		article.PublishedAt = &now
	}

	if err := h.db.Create(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.saveBlocks(article.ID, req.Blocks); err != nil {
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
		c.JSON(http.StatusNotFound, gin.H{"error": "article not found"})
		return
	}

	var req ArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check slug uniqueness (excluding self)
	var count int64
	h.db.Model(&models.Article{}).Where("slug = ? AND id != ?", req.Slug, article.ID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "slug already exists"})
		return
	}

	wasPublished := article.Status == "published"

	article.Title = req.Title
	article.Slug = req.Slug
	article.Summary = req.Summary
	article.Category = req.Category
	article.Tags = req.Tags
	article.FeaturedImage = req.FeaturedImage
	if req.Status != "" {
		article.Status = req.Status
	}
	if article.Status == "published" && !wasPublished && article.PublishedAt == nil {
		now := time.Now()
		article.PublishedAt = &now
	}

	if err := h.db.Save(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.saveBlocks(article.ID, req.Blocks); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.db.Preload("Blocks", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order ASC") }).First(&article, article.ID)
	c.JSON(http.StatusOK, article)
}

func (h *ArticleHandler) DeleteArticle(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.Article{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
