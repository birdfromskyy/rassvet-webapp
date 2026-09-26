package handlers

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseArticlePublishedAtPreservesCalendarDate(t *testing.T) {
	date, err := parseArticlePublishedAt("2026-01-01")
	require.NoError(t, err)
	require.NotNil(t, date)
	require.Equal(t, "2026-01-01", date.Format("2006-01-02"))
	require.Equal(t, 12, date.Hour())

	empty, err := parseArticlePublishedAt("")
	require.NoError(t, err)
	require.Nil(t, empty)

	_, err = parseArticlePublishedAt("01.01.2026")
	require.Error(t, err)
}

func TestValidateArticleStatus(t *testing.T) {
	require.NoError(t, validateArticleStatus("draft"))
	require.NoError(t, validateArticleStatus("published"))
	require.Error(t, validateArticleStatus("scheduled"))
}

func TestValidateArticleVideoBlocksRejectsWallPosts(t *testing.T) {
	require.Error(t, validateArticleVideoBlocks([]BlockRequest{{
		Type:    "video",
		Content: "https://vk.com/wall-228149734_123",
	}}))
	require.NoError(t, validateArticleVideoBlocks([]BlockRequest{{
		Type:    "video",
		Content: "https://vk.com/clip-228149734_456239192",
	}}))
}
