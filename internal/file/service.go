package file

import (
	"io"
	"os"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo       *Repository
	storageDir string
}

func NewService(r *Repository, storageDir string) *Service {
	if _, err := os.Stat(storageDir); os.IsNotExist(err) {
		os.MkdirAll(storageDir, os.ModePerm)
	}

	return &Service{repo: r, storageDir: storageDir}
}

func (s *Service) UploadFile(filename string, data io.Reader, deleteAfterDownload bool, expiresAfter time.Duration) (*FileRecord, error) {
	folderID := uuid.NewString()
	folderPath := s.storageDir + "/" + folderID

	if err := os.MkdirAll(folderPath, os.ModePerm); err != nil {
		return nil, err
	}

	path := folderPath + "/" + filename

	out, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	defer out.Close()

	size, err := io.Copy(out, data)
	if err != nil {
		return nil, err
	}

	f := &FileRecord{
		ID:                  folderID,
		DeletionID:          uuid.NewString(),
		Filename:            filename,
		Path:                path,
		Size:                size,
		CreatedAt:           time.Now(),
		ExpiresAt:           time.Now().Add(expiresAfter),
		DeleteAfterDownload: deleteAfterDownload,
	}

	if err := s.repo.Create(f); err != nil {
		return nil, err
	}

	return f, nil
}

// DownloadFile Download a file
func (s *Service) DownloadFile(id string) (*FileRecord, error) {
	f, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if f.Deleted || time.Now().After(f.ExpiresAt) {
		return nil, ErrFileNotFound
	}

	_ = s.repo.IncrementDownload(f)

	if f.DeleteAfterDownload {
		_ = s.repo.MarkDeleted(f)
	}

	return f, nil
}

func (s *Service) DeleteFileByID(id string) (*FileRecord, error) {
	f, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if f.Deleted {
		return nil, ErrFileNotFound
	}

	if err := s.repo.MarkDeleted(f); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) DeleteFileByDeletionID(delID string) (*FileRecord, error) {
	f, err := s.repo.GetByDeletionID(delID)
	if err != nil {
		return nil, err
	}

	if f.Deleted {
		return nil, ErrFileNotFound
	}

	if err := s.repo.MarkDeleted(f); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) ForceDelete(id string) (*FileRecord, error) {
	f, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if err := os.RemoveAll(s.storageDir + "/" + f.ID); err != nil {
		return nil, err
	}

	if err := s.repo.Delete(f); err != nil {
		return nil, err
	}

	return f, nil
}

func (s *Service) GetPaginatedFiles(limit, offset int) ([]FileRecord, int, error) {
	return s.repo.GetPaginated(limit, offset)
}

func (s *Service) GetFileByID(id string) (*FileRecord, error) {
	return s.repo.GetByID(id)
}

func (s *Service) GetFileByDeletionID(delID string) (*FileRecord, error) {
	return s.repo.GetByDeletionID(delID)
}
