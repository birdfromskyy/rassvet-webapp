// Package logging tees the app's log output to stdout AND a rotating file, so
// history survives container recreation (a redeploy makes a new container and
// wipes `docker logs`). Mount the log dir on a Docker volume to persist it.
package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"

	"github.com/gin-gonic/gin"
)

// Setup routes stdlib log + Gin output to stdout and dir/backend.log.
// Call it at the very start of main(), BEFORE gin.Default() (which captures the
// writer). If dir is empty or unwritable, it silently stays stdout-only.
func Setup(dir string) {
	if dir == "" {
		return
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("[LOG] cannot create log dir %s: %v (stdout only)", dir, err)
		return
	}
	w := &rotator{path: filepath.Join(dir, "backend.log"), maxBytes: 20 << 20, keep: 5}
	mw := io.MultiWriter(os.Stdout, w)
	log.SetOutput(mw)
	gin.DefaultWriter = mw
	gin.DefaultErrorWriter = mw
	log.Printf("[LOG] persistent logging enabled at %s (rotate 20MB x5)", w.path)
}

// rotator is a minimal size-based rotating file writer (no external deps).
type rotator struct {
	mu       sync.Mutex
	path     string
	maxBytes int64
	keep     int
	f        *os.File
	size     int64
}

func (r *rotator) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.f == nil {
		if err := r.open(); err != nil {
			return len(p), nil // never let logging failures break the app
		}
	}
	if r.size+int64(len(p)) > r.maxBytes {
		r.rotate()
	}
	n, err := r.f.Write(p)
	r.size += int64(n)
	return n, err
}

func (r *rotator) open() error {
	f, err := os.OpenFile(r.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	if st, e := f.Stat(); e == nil {
		r.size = st.Size()
	}
	r.f = f
	return nil
}

func (r *rotator) rotate() {
	if r.f != nil {
		_ = r.f.Close()
	}
	for i := r.keep - 1; i >= 1; i-- {
		_ = os.Rename(fmt.Sprintf("%s.%d", r.path, i), fmt.Sprintf("%s.%d", r.path, i+1))
	}
	_ = os.Rename(r.path, r.path+".1")
	r.size = 0
	_ = r.open()
}
