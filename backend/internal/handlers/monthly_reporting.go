package handlers

import (
	"backend/internal/logging"
	"backend/internal/models"
	"backend/internal/services/reporting"
	"bytes"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// RegisterMonthlyReportingRoutes must be mounted inside the authenticated
// admin group. It deliberately exposes no document credentials or files.
func RegisterMonthlyReportingRoutes(admin *gin.RouterGroup, db *gorm.DB) {
	h := monthlyReportingHandler{service: reporting.Service{DB: db}}
	admin.PUT("/students/:id/identity", h.identity)
	admin.GET("/legal-representatives", h.representatives)
	admin.GET("/legal-representatives/:representativeId", h.representative)
	admin.POST("/legal-representatives", h.saveRepresentative)
	admin.PUT("/legal-representatives/:representativeId", h.saveRepresentative)
	admin.GET("/students/:id/legal-representatives", h.links)
	admin.PUT("/students/:id/legal-representatives/:representativeId", h.saveLink)
	admin.GET("/social-service-report-settings", h.settings)
	admin.PUT("/social-service-report-settings", h.saveSettings)
	admin.GET("/students/:id/service-months", h.months)
	admin.GET("/students/:id/service-months/:month", h.month)
	admin.POST("/students/:id/service-months/:month", h.createMonth)
	admin.PUT("/students/:id/service-months/:month", h.updateMonth)
	admin.POST("/students/:id/service-months/:month/finalize", h.finalize)
	admin.POST("/students/:id/service-months/:month/reopen", h.reopen)
	admin.POST("/students/:id/service-months/:month/copy-previous", h.copyPrevious)
	admin.GET("/students/:id/service-months/:month/revisions", h.revisions)
}

type monthlyReportingHandler struct{ service reporting.Service }

func (h monthlyReportingHandler) representative(c *gin.Context) {
	id, ok := reportingID(c, "representativeId")
	if !ok {
		return
	}
	var r models.LegalRepresentative
	if err := h.service.DB.First(&r, id).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"representative": r})
}

func reportingError(c *gin.Context, err error) {
	var e *reporting.Error
	var pg *pgconn.PgError
	switch {
	case errors.As(err, &e):
		c.JSON(e.Status, gin.H{"error": e.Message})
	case errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(404, gin.H{"error": "Запись не найдена"})
	case errors.As(err, &pg) && (pg.Code == "23505" || pg.Code == "23503" || pg.Code == "23514"):
		c.JSON(409, gin.H{"error": "Конфликт данных. Обновите запись и проверьте связи"})
	default:
		c.JSON(500, gin.H{"error": "Не удалось выполнить операцию"})
	}
}
func reportingBody(c *gin.Context, target interface{}, required ...string) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1024*1024)
	d := json.NewDecoder(c.Request.Body)
	var raw json.RawMessage
	if err := d.Decode(&raw); err != nil {
		c.JSON(400, gin.H{"error": "Некорректный JSON или неизвестные поля"})
		return false
	}
	if err := d.Decode(new(interface{})); err != io.EOF {
		c.JSON(400, gin.H{"error": "Ожидается один JSON-объект"})
		return false
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		c.JSON(400, gin.H{"error": "Некорректный JSON или неизвестные поля"})
		return false
	}
	if len(required) > 0 {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			c.JSON(400, gin.H{"error": "Ожидается JSON-объект"})
			return false
		}
		for _, field := range required {
			if _, ok := fields[field]; !ok {
				c.JSON(400, gin.H{"error": "Необходимо поле " + field})
				return false
			}
		}
	}
	return true
}
func reportingID(c *gin.Context, key string) (uint, bool) {
	n, err := strconv.ParseUint(c.Param(key), 10, 32)
	if err != nil || n == 0 {
		c.JSON(400, gin.H{"error": "Некорректный ID"})
		return 0, false
	}
	return uint(n), true
}
func reportingActor(c *gin.Context) *uint {
	n := c.GetUint("userID")
	if n == 0 {
		return nil
	}
	return &n
}
func reportingPage(c *gin.Context) (int, int, bool) {
	limit, offset := 100, 0
	for key, p := range map[string]*int{"limit": &limit, "offset": &offset} {
		if v := c.Query(key); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 0 {
				c.JSON(400, gin.H{"error": "Некорректная пагинация"})
				return 0, 0, false
			}
			*p = n
		}
	}
	if limit < 1 || limit > 100 || offset > 1000000 {
		c.JSON(400, gin.H{"error": "limit: 1–100, offset: 0–1000000"})
		return 0, 0, false
	}
	return limit, offset, true
}
func replyMonth(c *gin.Context, m models.StudentServiceMonth, err error) {
	if err != nil {
		reportingError(c, err)
		return
	}
	c.Header("ETag", `"`+strconv.FormatInt(m.Revision, 10)+`"`)
	c.JSON(200, gin.H{"month": m, "totals": reporting.Calculate(m.Items)})
}
func (h monthlyReportingHandler) identity(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in reporting.PersonInput
	if !reportingBody(c, &in) {
		return
	}
	st, err := h.service.UpdateStudentIdentity(id, in)
	if err != nil {
		reportingError(c, err)
		return
	}
	logging.AdminMutation(c, "reporting.student.identity", nil, gin.H{"student_id": st.ID, "revision": st.IdentityRevision})
	c.JSON(200, gin.H{"student": st})
}
func (h monthlyReportingHandler) representatives(c *gin.Context) {
	limit, offset, ok := reportingPage(c)
	if !ok {
		return
	}
	rows := []models.LegalRepresentative{}
	q := h.service.DB.Model(&models.LegalRepresentative{})
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		if len(search) > 512 {
			c.JSON(400, gin.H{"error": "Слишком длинный поиск"})
			return
		}
		q = q.Where("concat_ws(' ', last_name, first_name, middle_name) ILIKE ?", "%"+search+"%")
	}
	if err := q.Order("last_name, first_name, middle_name, id").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"representatives": rows})
}
func (h monthlyReportingHandler) saveRepresentative(c *gin.Context) {
	var id uint
	if c.Param("representativeId") != "" {
		var ok bool
		id, ok = reportingID(c, "representativeId")
		if !ok {
			return
		}
	}
	var in reporting.RepresentativeInput
	if !reportingBody(c, &in) {
		return
	}
	r, err := h.service.SaveRepresentative(id, in, reportingActor(c))
	if err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"representative": r})
}
func (h monthlyReportingHandler) links(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	limit, offset, ok := reportingPage(c)
	if !ok {
		return
	}
	rows := []models.StudentLegalRepresentative{}
	if err := h.service.DB.Where("student_id = ?", id).Order("id").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"links": rows})
}
func (h monthlyReportingHandler) saveLink(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	rep, ok := reportingID(c, "representativeId")
	if !ok {
		return
	}
	var in reporting.LinkInput
	if !reportingBody(c, &in) {
		return
	}
	link, err := h.service.SaveLink(id, rep, in, reportingActor(c))
	if err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"link": link})
}
func (h monthlyReportingHandler) settings(c *gin.Context) {
	var settings models.SocialServiceReportSettings
	if err := h.service.DB.First(&settings, 1).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"settings": settings})
}
func (h monthlyReportingHandler) saveSettings(c *gin.Context) {
	var in reporting.SettingsInput
	if !reportingBody(c, &in) {
		return
	}
	settings, err := h.service.UpdateSettings(in, reportingActor(c))
	if err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"settings": settings})
}
func (h monthlyReportingHandler) months(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	limit, offset, ok := reportingPage(c)
	if !ok {
		return
	}
	rows := []models.StudentServiceMonth{}
	q := h.service.DB.Where("student_id = ?", id)
	if year := c.Query("year"); year != "" {
		n, err := strconv.Atoi(year)
		if err != nil || n < 1 || n > 9998 {
			c.JSON(400, gin.H{"error": "Некорректный год"})
			return
		}
		q = q.Where("EXTRACT(YEAR FROM month) = ?", n)
	}
	if err := q.Order("month DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"months": rows})
}
func (h monthlyReportingHandler) month(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	m, err := h.service.Get(id, models.Date(c.Param("month")))
	replyMonth(c, m, err)
}
func (h monthlyReportingHandler) createMonth(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in reporting.CreateInput
	if !reportingBody(c, &in) {
		return
	}
	m, err := h.service.Create(id, models.Date(c.Param("month")), in, reportingActor(c))
	replyMonth(c, m, err)
}
func (h monthlyReportingHandler) updateMonth(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in reporting.MonthInput
	if !reportingBody(c, &in, "representative_id", "items") {
		return
	}
	m, err := h.service.Update(id, models.Date(c.Param("month")), in, reportingActor(c))
	replyMonth(c, m, err)
}
func (h monthlyReportingHandler) finalize(c *gin.Context) { h.transition(c, true) }
func (h monthlyReportingHandler) copyPrevious(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in struct {
		Revision int64 `json:"revision"`
	}
	if !reportingBody(c, &in) {
		return
	}
	m, err := h.service.CopyPreviousIntoDraft(id, models.Date(c.Param("month")), in.Revision, reportingActor(c))
	replyMonth(c, m, err)
}
func (h monthlyReportingHandler) reopen(c *gin.Context) { h.transition(c, false) }
func (h monthlyReportingHandler) transition(c *gin.Context, finalize bool) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	var in struct {
		Revision int64 `json:"revision"`
	}
	if !reportingBody(c, &in) {
		return
	}
	m, err := h.service.Transition(id, models.Date(c.Param("month")), in.Revision, finalize, reportingActor(c))
	replyMonth(c, m, err)
}
func (h monthlyReportingHandler) revisions(c *gin.Context) {
	id, ok := reportingID(c, "id")
	if !ok {
		return
	}
	limit, offset, ok := reportingPage(c)
	if !ok {
		return
	}
	month := models.Date(c.Param("month"))
	if err := reporting.ValidateMonth(month); err != nil {
		reportingError(c, err)
		return
	}
	var m models.StudentServiceMonth
	if err := h.service.DB.Where("student_id = ? AND month = ?", id, month).First(&m).Error; err != nil {
		reportingError(c, err)
		return
	}
	q := h.service.DB.Where("month_id = ?", m.ID)
	if v := c.Query("revision"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 1 {
			c.JSON(400, gin.H{"error": "Некорректная revision"})
			return
		}
		q = q.Where("revision = ?", n)
	}
	rows := []models.StudentServiceMonthRevision{}
	if err := q.Order("revision DESC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		reportingError(c, err)
		return
	}
	c.JSON(200, gin.H{"revisions": rows})
}
