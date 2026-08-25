package handlers

import (
	"os"
	"path/filepath"
	"strings"
)

// deleteUploadFile removes a public uploaded file from disk.
// urlPath is the value stored in DB, e.g. "/uploads/abc123.jpg".
// Silently ignores empty paths and missing files.
func deleteUploadFile(urlPath string) {
	if urlPath == "" {
		return
	}
	// Only remove files that live inside ./uploads/ — safety guard against
	// accidental deletion of files outside the uploads directory.
	cleanPath := filepath.ToSlash(filepath.Clean(urlPath))
	filename := strings.TrimPrefix(cleanPath, "/uploads/")
	if cleanPath != urlPath || filename == cleanPath || filename == "" || strings.Contains(filename, "/") {
		return
	}
	_ = os.Remove(filepath.Join(uploadsDir, filename))
}
