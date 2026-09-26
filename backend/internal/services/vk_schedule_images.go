package services

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"strings"
	"sync"
	"time"

	"backend/internal/models"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/math/fixed"
)

const (
	scheduleImageWidth    = 1080
	scheduleImageMaxCards = 8
)

var (
	scheduleImageFontOnce sync.Once
	scheduleImageFonts    struct {
		regular *opentype.Font
		bold    *opentype.Font
		err     error
	}
)

type scheduleImagePalette struct {
	paper        color.RGBA
	navy         color.RGBA
	ink          color.RGBA
	muted        color.RGBA
	border       color.RGBA
	yellow       color.RGBA
	consultation color.RGBA
	group        color.RGBA
}

type scheduleImagePage struct {
	PNG     []byte
	Heading string
	Slots   []models.ScheduleSlot
}

var vkSchedulePalette = scheduleImagePalette{
	paper:        color.RGBA{245, 244, 239, 255},
	navy:         color.RGBA{7, 54, 77, 255},
	ink:          color.RGBA{11, 73, 106, 255},
	muted:        color.RGBA{85, 115, 135, 255},
	border:       color.RGBA{207, 218, 224, 255},
	yellow:       color.RGBA{255, 225, 0, 255},
	consultation: color.RGBA{245, 158, 11, 255},
	group:        color.RGBA{76, 175, 80, 255},
}

// renderScheduleImages returns one or more complete PNG cards. Splitting a
// busy day into eight-card pages keeps every photo legible in VK clients.
func renderScheduleImages(heading, date string, slots []models.ScheduleSlot) ([][]byte, error) {
	pages, err := renderScheduleImagePages(heading, date, slots)
	if err != nil {
		return nil, err
	}
	images := make([][]byte, len(pages))
	for index, page := range pages {
		images[index] = page.PNG
	}
	return images, nil
}

func renderScheduleImagePages(heading, date string, slots []models.ScheduleSlot) ([]scheduleImagePage, error) {
	if len(slots) == 0 {
		return nil, nil
	}
	if err := loadScheduleImageFonts(); err != nil {
		return nil, err
	}

	pages := make([]scheduleImagePage, 0, (len(slots)+scheduleImageMaxCards-1)/scheduleImageMaxCards)
	for start := 0; start < len(slots); start += scheduleImageMaxCards {
		end := min(start+scheduleImageMaxCards, len(slots))
		pageHeading := heading
		if len(slots) > scheduleImageMaxCards {
			pageHeading = fmt.Sprintf("%s · %d/%d", heading, start/scheduleImageMaxCards+1, (len(slots)+scheduleImageMaxCards-1)/scheduleImageMaxCards)
		}
		imageBytes, err := renderScheduleImage(pageHeading, date, slots[start:end])
		if err != nil {
			return nil, err
		}
		pages = append(pages, scheduleImagePage{PNG: imageBytes, Heading: pageHeading, Slots: slots[start:end]})
	}
	return pages, nil
}

func renderScheduleImage(heading, date string, slots []models.ScheduleSlot) ([]byte, error) {
	// This function is also used for individual change-event cards, which do
	// not pass through renderScheduleImagePages. Keep font initialization at
	// this lowest shared entry point to prevent a nil face in the background
	// worker during application startup.
	if err := loadScheduleImageFonts(); err != nil {
		return nil, err
	}
	const (
		outer      = 40
		headerH    = 244
		cardGap    = 20
		cardRadius = 26
	)
	// The content keeps a 52px rhythm above the first card and below the
	// last one; the outer white container then has its own 40px edge.
	cardHeights := make([]int, len(slots))
	cardsHeight := 0
	for index, slot := range slots {
		cardHeights[index] = scheduleSlotCardHeight(slot)
		cardsHeight += cardHeights[index]
	}
	height := headerH + 52 + cardsHeight + max(0, len(slots)-1)*cardGap + 92
	canvas := image.NewRGBA(image.Rect(0, 0, scheduleImageWidth, height))
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(vkSchedulePalette.paper), image.Point{}, draw.Src)
	fillRounded(canvas, image.Rect(outer, outer, scheduleImageWidth-outer, height-outer), 36, color.White)
	fillRounded(canvas, image.Rect(outer, outer, scheduleImageWidth-outer, headerH), 36, vkSchedulePalette.navy)
	draw.Draw(canvas, image.Rect(outer, headerH-36, scheduleImageWidth-outer, headerH), image.NewUniform(vkSchedulePalette.navy), image.Point{}, draw.Src)

	regular, bold := scheduleFaces(27, 34)
	drawSingleLine(canvas, bold, 100, 96, "РАСсвет", vkSchedulePalette.yellow)
	drawSingleLine(canvas, bold, 100, 158, heading, color.White)
	drawSingleLine(canvas, regular, 100, 208, date, color.RGBA{200, 217, 226, 255})

	y := headerH + 52
	for index, slot := range slots {
		cardHeight := cardHeights[index]
		drawScheduleSlotCard(canvas, image.Rect(82, y, scheduleImageWidth-82, y+cardHeight), cardRadius, slot)
		y += cardHeight + cardGap
	}

	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, fmt.Errorf("encode schedule PNG: %w", err)
	}
	return output.Bytes(), nil
}

type scheduleEventImageKind string

const (
	scheduleEventCreated   scheduleEventImageKind = "created"
	scheduleEventUpdated   scheduleEventImageKind = "updated"
	scheduleEventCancelled scheduleEventImageKind = "cancelled"
)

// renderScheduleEventImage is intentionally distinct from a daily digest: it
// makes the event itself obvious, while the final card keeps the same visual
// language and field hierarchy as the recipient's regular schedule.
func renderScheduleEventImage(kind scheduleEventImageKind, beforeDate, afterDate time.Time, before, after models.ScheduleSlot) ([]byte, error) {
	if err := loadScheduleImageFonts(); err != nil {
		return nil, err
	}
	const (
		outer      = 40
		headerH    = 244
		cardRadius = 26
		bannerH    = 76
	)
	isUpdate := kind == scheduleEventUpdated
	heading := "Добавлено занятие"
	bannerText := "В расписание добавлено новое занятие"
	bannerFill := color.RGBA{234, 247, 236, 255}
	bannerInk := color.RGBA{35, 122, 56, 255}
	slot := after
	if kind == scheduleEventUpdated {
		heading = "Изменено занятие"
		bannerText = "Изменились данные занятия"
		bannerFill = color.RGBA{233, 244, 255, 255}
		bannerInk = color.RGBA{20, 109, 165, 255}
	} else if kind == scheduleEventCancelled {
		heading = "Занятие отменено"
		bannerText = "Занятие не состоится"
		bannerFill = color.RGBA{255, 240, 240, 255}
		bannerInk = color.RGBA{187, 46, 54, 255}
		slot = before
		slot.Status = models.ScheduleSlotStatusCancelled
	}
	changes := scheduleEventImageChanges(beforeDate, afterDate, before, after)
	changeRows := scheduleEventImageChangeRows(changes, scheduleImageWidth-200)
	cardH := scheduleSlotCardHeight(slot)
	height := headerH + 52 + bannerH + 32 + cardH + 92
	if isUpdate {
		changesHeight := 0
		for _, row := range changeRows {
			changesHeight += row.Height
		}
		// The change list and the resulting lesson card are both content-sized:
		// long room/group names are wrapped rather than shortened with an ellipsis.
		height = headerH + 52 + bannerH + 34 + changesHeight + 28 + cardH + 92
	}
	canvas := image.NewRGBA(image.Rect(0, 0, scheduleImageWidth, height))
	draw.Draw(canvas, canvas.Bounds(), image.NewUniform(vkSchedulePalette.paper), image.Point{}, draw.Src)
	fillRounded(canvas, image.Rect(outer, outer, scheduleImageWidth-outer, height-outer), 36, color.White)

	headerDate := afterDate
	if kind == scheduleEventCancelled {
		headerDate = beforeDate
	}
	drawScheduleImageHeader(canvas, headerH, heading, russianFullDate(headerDate))

	bannerBounds := image.Rect(82, headerH+52, scheduleImageWidth-82, headerH+52+bannerH)
	fillRounded(canvas, bannerBounds, 18, bannerFill)
	_, bannerFace := scheduleFaces(26, 28)
	drawSingleLine(canvas, bannerFace, bannerBounds.Min.X+34, bannerBounds.Min.Y+49, truncateToWidth(bannerFace, bannerText, bannerBounds.Dx()-68), bannerInk)

	if !isUpdate {
		cardBounds := image.Rect(82, bannerBounds.Max.Y+32, scheduleImageWidth-82, bannerBounds.Max.Y+32+cardH)
		drawScheduleSlotCard(canvas, cardBounds, cardRadius, slot)
		if kind == scheduleEventCancelled {
			drawCancellationStrike(canvas, cardBounds)
		}
		return encodeScheduleImage(canvas)
	}

	labelFace, valueFace := scheduleFaces(22, 29)
	changeY := bannerBounds.Max.Y + 34
	rowY := changeY
	for index, row := range changeRows {
		drawSingleLine(canvas, labelFace, 100, rowY+24, row.Label, vkSchedulePalette.muted)
		for lineIndex, line := range row.ValueLines {
			drawSingleLine(canvas, valueFace, 100, rowY+59+lineIndex*34, line, vkSchedulePalette.ink)
		}
		if index < len(changeRows)-1 {
			separatorY := rowY + row.Height - 1
			draw.Draw(canvas, image.Rect(100, separatorY, scheduleImageWidth-130, separatorY+2), image.NewUniform(color.RGBA{229, 235, 238, 255}), image.Point{}, draw.Src)
		}
		rowY += row.Height
	}
	cardY := rowY + 28
	cardBounds := image.Rect(82, cardY, scheduleImageWidth-82, cardY+cardH)
	drawScheduleSlotCard(canvas, cardBounds, cardRadius, after)
	return encodeScheduleImage(canvas)
}

func drawScheduleImageHeader(canvas *image.RGBA, headerHeight int, heading, date string) {
	outer := 40
	fillRounded(canvas, image.Rect(outer, outer, scheduleImageWidth-outer, headerHeight), 36, vkSchedulePalette.navy)
	draw.Draw(canvas, image.Rect(outer, headerHeight-36, scheduleImageWidth-outer, headerHeight), image.NewUniform(vkSchedulePalette.navy), image.Point{}, draw.Src)
	regular, bold := scheduleFaces(27, 34)
	drawSingleLine(canvas, bold, 100, 96, "РАСсвет", vkSchedulePalette.yellow)
	drawSingleLine(canvas, bold, 100, 158, heading, color.White)
	drawSingleLine(canvas, regular, 100, 208, date, color.RGBA{200, 217, 226, 255})
}

type scheduleEventImageChange struct {
	Label  string
	Before string
	After  string
}

type scheduleEventImageChangeRow struct {
	Label      string
	ValueLines []string
	Height     int
}

// scheduleEventImageChangeRows keeps every changed value readable. A value
// such as a long room name is wrapped onto a second line and increases the
// event card height instead of being silently cut off.
func scheduleEventImageChangeRows(changes []scheduleEventImageChange, maxWidth int) []scheduleEventImageChangeRow {
	_, valueFace := scheduleFaces(22, 29)
	rows := make([]scheduleEventImageChangeRow, 0, len(changes))
	for _, change := range changes {
		valueLines := wrapTextToWidth(valueFace, fmt.Sprintf("%s → %s", change.Before, change.After), maxWidth)
		rows = append(rows, scheduleEventImageChangeRow{
			Label:      change.Label,
			ValueLines: valueLines,
			// 24 px to the label baseline, 35 px for each value line, and
			// 11 px of breathing room / divider below it. One line is 70 px.
			Height: 24 + len(valueLines)*35 + 11,
		})
	}
	return rows
}

func scheduleEventImageChanges(beforeDate, afterDate time.Time, before, after models.ScheduleSlot) []scheduleEventImageChange {
	changes := make([]scheduleEventImageChange, 0, 6)
	if !sameDate(beforeDate, afterDate) {
		changes = append(changes, scheduleEventImageChange{
			Label: "День занятия", Before: russianShortDate(beforeDate), After: russianShortDate(afterDate),
		})
	}
	if before.StartTime != after.StartTime || before.EndTime != after.EndTime {
		changes = append(changes, scheduleEventImageChange{
			Label: "Время", Before: before.StartTime + "–" + before.EndTime, After: after.StartTime + "–" + after.EndTime,
		})
	}
	oldAudience, newAudience := valueOrDash(scheduleSlotAudience(before)), valueOrDash(scheduleSlotAudience(after))
	if before.SlotType != after.SlotType || oldAudience != newAudience {
		label := "Ребёнок"
		if before.SlotType == models.SlotTypeGroup || after.SlotType == models.SlotTypeGroup {
			label = "Ребёнок / группа"
		}
		changes = append(changes, scheduleEventImageChange{Label: label, Before: oldAudience, After: newAudience})
	}
	oldKind, newKind := scheduleSlotImageKind(before), scheduleSlotImageKind(after)
	if oldKind != newKind {
		changes = append(changes, scheduleEventImageChange{Label: "Вид занятия", Before: oldKind, After: newKind})
	}
	oldSubject, newSubject := valueOrDash(scheduleSlotSubject(before)), valueOrDash(scheduleSlotSubject(after))
	if oldSubject != newSubject {
		changes = append(changes, scheduleEventImageChange{Label: "Предмет", Before: oldSubject, After: newSubject})
	}
	oldRoom, newRoom := valueOrDash(scheduleSlotRoom(before)), valueOrDash(scheduleSlotRoom(after))
	if oldRoom != newRoom {
		changes = append(changes, scheduleEventImageChange{Label: "Кабинет", Before: oldRoom, After: newRoom})
	}
	if len(changes) == 0 {
		changes = append(changes, scheduleEventImageChange{Label: "Занятие", Before: "текущие данные", After: "обновлены"})
	}
	return changes
}

func scheduleSlotImageKind(slot models.ScheduleSlot) string {
	if slot.IsConsultation() {
		return "Консультация"
	}
	if slot.SlotType == models.SlotTypeGroup {
		return "Групповое"
	}
	return "Индивидуальное"
}

func drawCancellationStrike(canvas *image.RGBA, bounds image.Rectangle) {
	startX, startY := bounds.Min.X+30, bounds.Min.Y+94
	endX, endY := bounds.Min.X+280, bounds.Min.Y+52
	steps := max(endX-startX, startY-endY)
	for step := 0; step <= steps; step++ {
		x := startX + (endX-startX)*step/steps
		y := startY + (endY-startY)*step/steps
		fillCircle(canvas, x, y, 2, color.RGBA{239, 83, 80, 255})
	}
}

func encodeScheduleImage(canvas image.Image) ([]byte, error) {
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, fmt.Errorf("encode schedule PNG: %w", err)
	}
	return output.Bytes(), nil
}

func drawScheduleSlotCard(canvas *image.RGBA, bounds image.Rectangle, radius int, slot models.ScheduleSlot) {
	background := color.RGBA{255, 255, 255, 255}
	stroke := vkSchedulePalette.border
	if slot.Status == models.ScheduleSlotStatusCancelled {
		background = color.RGBA{255, 244, 245, 255}
		stroke = color.RGBA{220, 104, 118, 255}
	} else if slot.IsConsultation() {
		background = color.RGBA{255, 244, 221, 255}
		stroke = color.RGBA{242, 171, 43, 255}
	} else if slot.SlotType == models.SlotTypeGroup {
		background = color.RGBA{234, 247, 236, 255}
		stroke = color.RGBA{91, 175, 111, 255}
	}
	fillRoundedWithBorder(canvas, bounds, radius, 3, background, stroke)

	regular, bold := scheduleFaces(27, 32)
	durationFace, _ := scheduleFaces(23, 23)
	contentX := bounds.Min.X + 310
	contentWidth := bounds.Max.X - contentX - 34
	text := scheduleSlotCardTextLayout(slot, contentWidth)
	drawSingleLine(canvas, bold, bounds.Min.X+32, bounds.Min.Y+62, fmt.Sprintf("%s–%s", slot.StartTime, slot.EndTime), vkSchedulePalette.ink)
	if duration := scheduleSlotDurationLabel(slot); duration != "" {
		drawSingleLine(canvas, durationFace, bounds.Min.X+32, bounds.Min.Y+112, duration, vkSchedulePalette.muted)
	}
	for index, line := range text.AudienceLines {
		drawSingleLine(canvas, bold, contentX, bounds.Min.Y+62+index*39, line, vkSchedulePalette.navy)
	}
	fieldInk := color.RGBA{40, 97, 128, 255}
	for index, line := range text.SubjectLines {
		drawSingleLine(canvas, regular, contentX, bounds.Min.Y+text.SubjectBaseline+index*34, line, fieldInk)
	}
	for index, line := range text.RoomLines {
		drawSingleLine(canvas, regular, contentX, bounds.Min.Y+text.RoomBaseline+index*34, line, fieldInk)
	}
}

type scheduleSlotCardText struct {
	AudienceLines   []string
	SubjectLines    []string
	RoomLines       []string
	SubjectBaseline int
	RoomBaseline    int
	Height          int
}

func scheduleSlotCardHeight(slot models.ScheduleSlot) int {
	// All schedule cards use the same horizontal bounds: 82px margins,
	// 310px for time/duration, and 34px right padding.
	contentWidth := scheduleImageWidth - 82 - (82 + 310) - 34
	return scheduleSlotCardTextLayout(slot, contentWidth).Height
}

func scheduleSlotCardTextLayout(slot models.ScheduleSlot, contentWidth int) scheduleSlotCardText {
	regular, bold := scheduleFaces(27, 32)
	audienceLines := wrapTextToWidth(bold, valueOrDash(scheduleSlotAudience(slot)), contentWidth)
	subjectLines := wrapTextToWidth(regular, "Предмет: "+scheduleSlotCardSubject(slot), contentWidth)
	roomLines := wrapTextToWidth(regular, "Кабинет: "+valueOrDash(scheduleSlotRoom(slot)), contentWidth)

	// These baselines preserve the original compact card when each field fits
	// on one line. Extra lines increase the card downwards with the same rhythm.
	subjectBaseline := 62 + len(audienceLines)*39 + 10
	roomBaseline := subjectBaseline + len(subjectLines)*34 + 3
	lastRoomBaseline := roomBaseline + (len(roomLines)-1)*34
	return scheduleSlotCardText{
		AudienceLines:   audienceLines,
		SubjectLines:    subjectLines,
		RoomLines:       roomLines,
		SubjectBaseline: subjectBaseline,
		RoomBaseline:    roomBaseline,
		Height:          max(172, lastRoomBaseline+24),
	}
}

func scheduleSlotDurationLabel(slot models.ScheduleSlot) string {
	start, startErr := time.Parse("15:04", slot.StartTime)
	end, endErr := time.Parse("15:04", slot.EndTime)
	if startErr != nil || endErr != nil {
		return ""
	}
	minutes := int(end.Sub(start).Minutes())
	if minutes <= 0 {
		return ""
	}
	lastTwo := minutes % 100
	last := minutes % 10
	word := "минут"
	if lastTwo < 11 || lastTwo > 14 {
		switch last {
		case 1:
			word = "минута"
		case 2, 3, 4:
			word = "минуты"
		}
	}
	return fmt.Sprintf("%d %s", minutes, word)
}

func scheduleSlotCardSubject(slot models.ScheduleSlot) string {
	subject := valueOrDash(scheduleSlotSubject(slot))
	if slot.IsConsultation() {
		return "Консультация • " + subject
	}
	if slot.SlotType == models.SlotTypeGroup {
		return "Групповое • " + subject
	}
	return subject
}

func loadScheduleImageFonts() error {
	scheduleImageFontOnce.Do(func() {
		regular, err := readScheduleFont([]string{
			"/usr/share/fonts/dejavu/DejaVuSans.ttf",
			"/usr/share/fonts/TTF/DejaVuSans.ttf",
			"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
			"/System/Library/Fonts/Supplemental/Arial.ttf",
		})
		if err != nil {
			scheduleImageFonts.err = err
			return
		}
		bold, err := readScheduleFont([]string{
			"/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
			"/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
			"/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
			"/System/Library/Fonts/Supplemental/Arial Bold.ttf",
		})
		if err != nil {
			scheduleImageFonts.err = err
			return
		}
		scheduleImageFonts.regular = regular
		scheduleImageFonts.bold = bold
	})
	return scheduleImageFonts.err
}

func readScheduleFont(paths []string) (*opentype.Font, error) {
	for _, path := range paths {
		contents, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		parsed, err := opentype.Parse(contents)
		if err == nil {
			return parsed, nil
		}
	}
	return nil, fmt.Errorf("не найден шрифт для PNG-уведомлений")
}

func scheduleFaces(regularSize, boldSize float64) (font.Face, font.Face) {
	regular, _ := opentype.NewFace(scheduleImageFonts.regular, &opentype.FaceOptions{Size: regularSize, DPI: 72, Hinting: font.HintingFull})
	bold, _ := opentype.NewFace(scheduleImageFonts.bold, &opentype.FaceOptions{Size: boldSize, DPI: 72, Hinting: font.HintingFull})
	return regular, bold
}

func drawSingleLine(canvas *image.RGBA, face font.Face, x, baseline int, value string, ink color.Color) {
	drawer := font.Drawer{Dst: canvas, Src: image.NewUniform(ink), Face: face, Dot: fixed.P(x, baseline)}
	drawer.DrawString(value)
}

func textWidth(face font.Face, value string) int {
	return font.MeasureString(face, value).Ceil()
}

func truncateToWidth(face font.Face, value string, maxWidth int) string {
	value = strings.TrimSpace(value)
	if textWidth(face, value) <= maxWidth {
		return value
	}
	const ellipsis = "…"
	runes := []rune(value)
	for len(runes) > 0 {
		candidate := string(runes) + ellipsis
		if textWidth(face, candidate) <= maxWidth {
			return candidate
		}
		runes = runes[:len(runes)-1]
	}
	return ellipsis
}

// wrapTextToWidth preserves the complete text. It prefers word boundaries and
// only splits a single exceptionally long token when that is the sole way to
// keep it inside the card.
func wrapTextToWidth(face font.Face, value string, maxWidth int) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{"не указан"}
	}
	maxWidth = max(1, maxWidth)
	words := strings.Fields(value)
	lines := make([]string, 0, 2)
	line := ""
	for _, word := range words {
		if textWidth(face, word) > maxWidth {
			if line != "" {
				lines = append(lines, line)
				line = ""
			}
			parts := splitTextTokenToWidth(face, word, maxWidth)
			lines = append(lines, parts[:len(parts)-1]...)
			line = parts[len(parts)-1]
			continue
		}
		candidate := word
		if line != "" {
			candidate = line + " " + word
		}
		if textWidth(face, candidate) <= maxWidth {
			line = candidate
			continue
		}
		lines = append(lines, line)
		line = word
	}
	if line != "" {
		lines = append(lines, line)
	}
	return lines
}

func splitTextTokenToWidth(face font.Face, token string, maxWidth int) []string {
	runes := []rune(token)
	parts := make([]string, 0, 2)
	for len(runes) > 0 {
		cut := len(runes)
		for cut > 1 && textWidth(face, string(runes[:cut])) > maxWidth {
			cut--
		}
		parts = append(parts, string(runes[:cut]))
		runes = runes[cut:]
	}
	return parts
}

func fillRounded(canvas *image.RGBA, bounds image.Rectangle, radius int, fill color.Color) {
	if radius <= 0 {
		draw.Draw(canvas, bounds, image.NewUniform(fill), image.Point{}, draw.Src)
		return
	}
	draw.Draw(canvas, image.Rect(bounds.Min.X+radius, bounds.Min.Y, bounds.Max.X-radius, bounds.Max.Y), image.NewUniform(fill), image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(bounds.Min.X, bounds.Min.Y+radius, bounds.Max.X, bounds.Max.Y-radius), image.NewUniform(fill), image.Point{}, draw.Src)
	fillCircle(canvas, bounds.Min.X+radius, bounds.Min.Y+radius, radius, fill)
	fillCircle(canvas, bounds.Max.X-radius-1, bounds.Min.Y+radius, radius, fill)
	fillCircle(canvas, bounds.Min.X+radius, bounds.Max.Y-radius-1, radius, fill)
	fillCircle(canvas, bounds.Max.X-radius-1, bounds.Max.Y-radius-1, radius, fill)
}

// fillRoundedWithBorder draws a solid outer rounded shape and then an inset
// inner shape. Unlike tracing circle outlines, it cannot leave rings or gaps
// at the four corners after PNG rasterisation.
func fillRoundedWithBorder(canvas *image.RGBA, bounds image.Rectangle, radius, width int, fill, stroke color.Color) {
	fillRounded(canvas, bounds, radius, stroke)
	inner := image.Rect(bounds.Min.X+width, bounds.Min.Y+width, bounds.Max.X-width, bounds.Max.Y-width)
	fillRounded(canvas, inner, max(0, radius-width), fill)
}

func fillCircle(canvas *image.RGBA, centerX, centerY, radius int, fill color.Color) {
	for y := -radius; y <= radius; y++ {
		for x := -radius; x <= radius; x++ {
			if x*x+y*y <= radius*radius {
				canvas.Set(centerX+x, centerY+y, fill)
			}
		}
	}
}
