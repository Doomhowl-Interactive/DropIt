package file

import (
	"time"
)

type FileRecord struct {
	ID                  string    `gorm:"primaryKey" json:"id"`
	DeletionID          string    `json:"deletion_id"`
	Filename            string    `json:"filename"`
	Path                string    `json:"-"` // file path on disk (not exposed via JSON)
	ExpiresAt           time.Time `json:"expires_at"`
	DeleteAfterDownload bool      `json:"delete_after_download"`
	Size                int64     `json:"size"`
	DownloadCount       int       `json:"download_count"`
	Deleted             bool      `json:"deleted"`
	CreatedAt           time.Time `json:"created_at"`
}
