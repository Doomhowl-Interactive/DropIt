package file

import (
	"io"
	"os"
	"path/filepath"
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

func (s *Service) UploadFile(filename string, data io.Reader) (*FileRecord, error) {
	folderID := uuid.NewString()
	folderPath := s.storageDir + "/" + folderID

	if err := os.MkdirAll(folderPath, os.ModePerm); err != nil {
		return nil, err
	}

	safeName := uuid.NewString() + filepath.Ext(filename)
	path := filepath.Join(folderPath, safeName)

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
		ID:         folderID,
		DeletionID: uuid.NewString(),
		ViewID:     uuid.NewString(),
		Filename:   filename,
		Path:       path,
		Size:       size,
		CreatedAt:  time.Now(),
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

	if f.Deleted {
		return nil, ErrFileNotFound
	}

	_ = s.repo.IncrementDownload(f)

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

func (s *Service) GetFileByViewID(viewID string) (*FileRecord, error) {
	return s.repo.GetFileByViewID(viewID)
}

func (s *Service) ImportFiles(records []ImportFileRecord) error {
	for _, r := range records {

		existing, _ := s.repo.GetByID(r.ID)
		if existing != nil {
			continue
		}

		record := &FileRecord{
			ID:            r.ID,
			DeletionID:    r.DeletionID,
			Filename:      r.Filename,
			Path:          s.buildPath(r.ID, r.Filename),
			Size:          r.Size,
			DownloadCount: r.DownloadCount,
			Deleted:       r.Deleted,
			CreatedAt:     r.CreatedAt,
		}

		if err := s.repo.Create(record); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) buildPath(id, filename string) string {
	return s.storageDir + "/" + id + "/" + filename
}

func (s *Service) GetAllFiles() ([]FileRecord, error) {
	return s.repo.GetAll()
}
