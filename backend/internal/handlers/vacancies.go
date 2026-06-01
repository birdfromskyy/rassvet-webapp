package handlers

import (
	"net/http"
	"strconv"

	"backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VacancyHandler struct{ db *gorm.DB }

func NewVacancyHandler(db *gorm.DB) *VacancyHandler {
	return &VacancyHandler{db: db}
}

// GET /api/vacancies — public, only active
func (h *VacancyHandler) GetPublic(c *gin.Context) {
	var list []models.Vacancy
	h.db.Where("is_active = true").Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// GET /api/admin/vacancies
func (h *VacancyHandler) GetAll(c *gin.Context) {
	var list []models.Vacancy
	h.db.Order("sort_order ASC, id ASC").Find(&list)
	c.JSON(http.StatusOK, list)
}

// POST /api/admin/vacancies
func (h *VacancyHandler) Create(c *gin.Context) {
	var body models.Vacancy
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&body)
	c.JSON(http.StatusCreated, body)
}

// PUT /api/admin/vacancies/:id
func (h *VacancyHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var item models.Vacancy
	if err := h.db.First(&item, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
		return
	}
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.ID = uint(id)
	h.db.Save(&item)
	c.JSON(http.StatusOK, item)
}

// DELETE /api/admin/vacancies/:id
func (h *VacancyHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	h.db.Delete(&models.Vacancy{}, id)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
