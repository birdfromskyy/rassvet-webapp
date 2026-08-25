package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/stretchr/testify/require"
)

func TestLegacyAchievementBlocksPreserveContentOrder(t *testing.T) {
	item := models.Achievement{
		ID:             7,
		ChildName:      "Тестовая история",
		ImageURL:       "/uploads/first.jpg",
		SecondImageURL: "/uploads/second.jpg",
		Description:    `["Первый абзац","Второй абзац"]`,
	}

	blocks := legacyAchievementBlocks(item)
	require.Len(t, blocks, 4)
	require.Equal(t, []string{"image", "text", "text", "image"}, []string{blocks[0].Type, blocks[1].Type, blocks[2].Type, blocks[3].Type})
	require.Equal(t, "Первый абзац", blocks[1].Content)
	require.Equal(t, 7, int(blocks[0].AchievementID))
}

func TestNormalizeAchievementBlocksSupportsVideoAndRejectsUnsafeURL(t *testing.T) {
	blocks, err := normalizeAchievementBlocks([]achievementBlockRequest{
		{Type: "text", Content: " Текст "},
		{Type: "video", Content: "https://vkvideo.ru/video-1_2"},
		{Type: "image", Content: "   "},
	})
	require.NoError(t, err)
	require.Len(t, blocks, 2)
	require.Equal(t, "Текст", blocks[0].Content)
	require.Equal(t, 1, blocks[1].SortOrder)

	_, err = normalizeAchievementBlocks([]achievementBlockRequest{{Type: "video", Content: "javascript:alert(1)"}})
	require.Error(t, err)

	_, err = normalizeAchievementBlocks([]achievementBlockRequest{{Type: "file", Content: "/uploads/report.pdf"}})
	require.Error(t, err)

	_, err = normalizeAchievementBlocks([]achievementBlockRequest{{Type: "image", Content: "/uploads/../../main"}})
	require.Error(t, err)
}
