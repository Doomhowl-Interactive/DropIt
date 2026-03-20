package auth

import (
	"ResendIt/internal/security"
	"ResendIt/internal/user"
	"errors"
)

type Service struct {
	repo *Repository
}

func NewService(r *Repository) *Service {
	return &Service{repo: r}
}

func (s *Service) Login(username, password string) (string, error) {
	u, err := s.repo.FindByUsername(username)

	if errors.Is(err, user.ErrUserNotFound) {
		// Prevent user enumeration by returning a generic error message
		return "", ErrInvalidCredentials
	} else if err != nil {
		return "", err
	}

	if !security.CheckPassword(password, u.PasswordHash) {
		return "", ErrInvalidCredentials
	}

	return GenerateJWT(u.Username, u.Role)
}
