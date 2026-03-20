package file

import (
	"errors"

	"gorm.io/gorm"
)

var ErrFileNotFound = errors.New("file not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(f *FileRecord) error {
	return r.db.Create(f).Error
}

func (r *Repository) GetAll() ([]FileRecord, error) {
	var files []FileRecord
	if err := r.db.Find(&files).Error; err != nil {
		return nil, err
	}
	return files, nil
}

func (r *Repository) GetByID(id string) (*FileRecord, error) {
	var f FileRecord
	if err := r.db.First(&f, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrFileNotFound
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) GetPaginated(limit, offset int) ([]FileRecord, int, error) {
	var files []FileRecord
	var count int64

	if err := r.db.Model(&FileRecord{}).Count(&count).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&files).Error; err != nil {
		return nil, 0, err
	}

	return files, int(count), nil
}

func (r *Repository) GetByDeletionID(delID string) (*FileRecord, error) {
	var f FileRecord
	if err := r.db.First(&f, "deletion_id = ?", delID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrFileNotFound
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) IncrementDownload(f *FileRecord) error {
	f.DownloadCount++
	return r.db.Save(f).Error
}

// MarkDeleted Soft delete the record by setting Deleted to true
func (r *Repository) MarkDeleted(f *FileRecord) error {
	f.Deleted = true
	return r.db.Save(f).Error
}

// Delete Permanently delete the record from the database
func (r *Repository) Delete(f *FileRecord) error {
	return r.db.Delete(f).Error
}
