package handlers

import (
	"backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type EmployeeHandler struct {
	db *gorm.DB
}

func NewEmployeeHandler(db *gorm.DB) *EmployeeHandler {
	return &EmployeeHandler{db: db}
}

type EmployeeRequest struct {
	Name           string `json:"name" binding:"required"`
	Category       string `json:"category" binding:"required"`
	PhotoURL       string `json:"photo_url"`
	Qualifications string `json:"qualifications"` // JSON array string
	Education      string `json:"education"`      // JSON array string
	Experience     string `json:"experience"`
	SortOrder      int    `json:"sort_order"`
	IsActive       *bool  `json:"is_active"`
}

func (h *EmployeeHandler) GetEmployees(c *gin.Context) {
	var employees []models.Employee
	h.db.Where("is_active = ?", true).Order("sort_order ASC, id ASC").Find(&employees)
	c.JSON(http.StatusOK, employees)
}

func (h *EmployeeHandler) GetAllEmployees(c *gin.Context) {
	var employees []models.Employee
	h.db.Order("sort_order ASC, id ASC").Find(&employees)
	c.JSON(http.StatusOK, employees)
}

func (h *EmployeeHandler) CreateEmployee(c *gin.Context) {
	var req EmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	employee := models.Employee{
		Name:           req.Name,
		Category:       req.Category,
		PhotoURL:       req.PhotoURL,
		Qualifications: req.Qualifications,
		Education:      req.Education,
		Experience:     req.Experience,
		SortOrder:      req.SortOrder,
		IsActive:       isActive,
	}

	if err := h.db.Create(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, employee)
}

func (h *EmployeeHandler) UpdateEmployee(c *gin.Context) {
	id := c.Param("id")
	var employee models.Employee
	if err := h.db.First(&employee, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "employee not found"})
		return
	}

	var req EmployeeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	employee.Name = req.Name
	employee.Category = req.Category
	employee.PhotoURL = req.PhotoURL
	employee.Qualifications = req.Qualifications
	employee.Education = req.Education
	employee.Experience = req.Experience
	employee.SortOrder = req.SortOrder
	if req.IsActive != nil {
		employee.IsActive = *req.IsActive
	}

	if err := h.db.Save(&employee).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, employee)
}

func (h *EmployeeHandler) DeleteEmployee(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&models.Employee{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
