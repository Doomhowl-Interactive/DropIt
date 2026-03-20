package user

import (
	"ResendIt/internal/security"
	"errors"
)

var ErrCannotDeleteSelf = errors.New("cannot delete yourself")

type Service struct {
	repo *Repository
}

func NewService(r *Repository) *Service {
	return &Service{repo: r}
}

// CreateUser creates a new user with the given username, password, and role
func (s *Service) CreateUser(username, password, role string) (*User, error) {
	hash, err := security.HashPassword(password)
	if err != nil {
		return nil, err
	}

	u := &User{
		Username:     username,
		PasswordHash: hash,
		Role:         role,
	}

	if err := s.repo.Create(u); err != nil {
		return nil, err
	}

	return u, nil
}

// GetAllUsers returns all users
func (s *Service) GetAllUsers() ([]User, error) {
	return s.repo.GetAll()
}

// DeleteUser deletes a user by ID
func (s *Service) DeleteUser(requesterID, targetID uint) error {
	if requesterID == targetID {
		return ErrCannotDeleteSelf
	}

	return s.repo.Delete(targetID)
}

// FindByUsername returns a user by username
func (s *Service) FindByUsername(username string) (*User, error) {
	return s.repo.FindByUsername(username)
}
