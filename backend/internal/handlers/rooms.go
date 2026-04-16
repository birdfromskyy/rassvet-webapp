package handlers

import (
	"backend/internal/models"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type RoomHandler struct {
	db *gorm.DB
}

func NewRoomHandler(db *gorm.DB) *RoomHandler {
	return &RoomHandler{db: db}
}

type CreateRoomRequest struct {
	Name     string  `json:"name" binding:"required"`
	IsActive *bool   `json:"is_active"`
	Notes    *string `json:"notes"`
}

type UpdateRoomRequest struct {
	Name     string  `json:"name"`
	IsActive *bool   `json:"is_active"`
	Notes    *string `json:"notes"`
}

type UpdateRoomSubjectsRequest struct {
	SubjectIDs []uint `json:"subject_ids" binding:"required"`
}

func (h *RoomHandler) GetRooms(c *gin.Context) {
	var rooms []models.Room

	query := h.db.Order("id ASC")

	if isActive := c.Query("is_active"); isActive != "" {
		switch strings.ToLower(isActive) {
		case "true":
			query = query.Where("is_active = ?", true)
		case "false":
			query = query.Where("is_active = ?", false)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid is_active value"})
			return
		}
	}

	if err := query.Find(&rooms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rooms": rooms})
}

func (h *RoomHandler) GetRoomByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var room models.Room
	if err := h.db.First(&room, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"room": room})
}

func (h *RoomHandler) CreateRoom(c *gin.Context) {
	var req CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
		return
	}

	var existing models.Room
	if err := h.db.Where("LOWER(name) = LOWER(?)", req.Name).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Room with this name already exists"})
		return
	} else if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check room uniqueness"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var notes *string
	if req.Notes != nil {
		trimmed := strings.TrimSpace(*req.Notes)
		notes = &trimmed
	}

	room := models.Room{
		Name:     req.Name,
		IsActive: isActive,
		Notes:    notes,
	}

	if err := h.db.Select("Name", "IsActive", "Notes").Create(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	if !isActive {
		if err := h.db.Model(&room).Update("is_active", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
			return
		}
		room.IsActive = false
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Room created successfully",
		"room":    room,
	})
}

func (h *RoomHandler) UpdateRoom(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var req UpdateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var room models.Room
	if err := h.db.First(&room, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	if req.Name != "" {
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Name cannot be empty"})
			return
		}

		var existing models.Room
		if err := h.db.Where("LOWER(name) = LOWER(?) AND id <> ?", req.Name, id).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Room with this name already exists"})
			return
		} else if err != nil && err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check room uniqueness"})
			return
		}

		room.Name = req.Name
	}

	if req.IsActive != nil {
		room.IsActive = *req.IsActive
	}

	if req.Notes != nil {
		trimmed := strings.TrimSpace(*req.Notes)
		room.Notes = &trimmed
	}

	if err := h.db.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Room updated successfully",
		"room":    room,
	})
}

func (h *RoomHandler) DeactivateRoom(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var room models.Room
	if err := h.db.First(&room, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	room.IsActive = false

	if err := h.db.Save(&room).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Room deactivated successfully",
		"room":    room,
	})
}

func (h *RoomHandler) DeleteRoom(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var room models.Room
	if err := h.db.First(&room, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	if err := h.db.Delete(&room).Error; err != nil {
		if strings.Contains(err.Error(), "23503") || strings.Contains(err.Error(), "foreign key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Нельзя удалить кабинет: есть связанные слоты расписания. Сначала деактивируйте."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted successfully"})
}

func (h *RoomHandler) GetRoomSubjects(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil || roomID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var room models.Room
	if err := h.db.First(&room, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	var roomSubjects []models.RoomSubject
	if err := h.db.Preload("Subject").
		Where("room_id = ?", roomID).
		Find(&roomSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room subjects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"room_id":       room.ID,
		"room_name":     room.Name,
		"room_subjects": roomSubjects,
	})
}

func (h *RoomHandler) UpdateRoomSubjects(c *gin.Context) {
	roomID, err := strconv.Atoi(c.Param("id"))
	if err != nil || roomID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room id"})
		return
	}

	var req UpdateRoomSubjectsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var room models.Room
	if err := h.db.First(&room, roomID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch room"})
		return
	}

	uniqueSubjectIDs := make(map[uint]struct{})
	for _, id := range req.SubjectIDs {
		if id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Subject id must be positive"})
			return
		}
		uniqueSubjectIDs[id] = struct{}{}
	}

	subjectIDs := make([]uint, 0, len(uniqueSubjectIDs))
	for id := range uniqueSubjectIDs {
		subjectIDs = append(subjectIDs, id)
	}

	if len(subjectIDs) > 0 {
		var count int64
		if err := h.db.Model(&models.Subject{}).
			Where("id IN ?", subjectIDs).
			Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate subjects"})
			return
		}

		if count != int64(len(subjectIDs)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "One or more subject ids are invalid"})
			return
		}
	}

	tx := h.db.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	if err := tx.Where("room_id = ?", roomID).Delete(&models.RoomSubject{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear room subjects"})
		return
	}

	if len(subjectIDs) > 0 {
		roomSubjects := make([]models.RoomSubject, 0, len(subjectIDs))
		for _, subjectID := range subjectIDs {
			roomSubjects = append(roomSubjects, models.RoomSubject{
				RoomID:    uint(roomID),
				SubjectID: subjectID,
			})
		}

		if err := tx.Create(&roomSubjects).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save room subjects"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	var updatedRoomSubjects []models.RoomSubject
	if err := h.db.Preload("Subject").
		Where("room_id = ?", roomID).
		Find(&updatedRoomSubjects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated room subjects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Room subjects updated successfully",
		"room_id":       room.ID,
		"room_name":     room.Name,
		"room_subjects": updatedRoomSubjects,
	})
}
