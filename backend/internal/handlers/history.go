package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type HistoryHandler struct {
	db *gorm.DB
}

func NewHistoryHandler(db *gorm.DB) *HistoryHandler {
	return &HistoryHandler{db: db}
}

type HistoryEventRequest struct {
	Year      string `json:"year" binding:"required"`
	Items     string `json:"items" binding:"required"` // JSON array string
	SortOrder int    `json:"sort_order"`
}

func (h *HistoryHandler) GetEvents(c *gin.Context) {
	var events []models.HistoryEvent
	h.db.Order("sort_order ASC, year ASC").Find(&events)
	c.JSON(http.StatusOK, events)
}

func (h *HistoryHandler) CreateEvent(c *gin.Context) {
	var req HistoryEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	event := models.HistoryEvent{
		Year:      req.Year,
		Items:     req.Items,
		SortOrder: req.SortOrder,
	}

	if err := h.db.Create(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, event)
}

func (h *HistoryHandler) UpdateEvent(c *gin.Context) {
	id := c.Param("id")
	var event models.HistoryEvent
	if err := h.db.First(&event, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Событие не найдено"})
		return
	}

	var req HistoryEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	event.Year = req.Year
	event.Items = req.Items
	event.SortOrder = req.SortOrder

	if err := h.db.Save(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, event)
}

func (h *HistoryHandler) DeleteEvent(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.HistoryEvent{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
