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

// UpdateUser updates a user's information
func (s *Service) UpdateUser(user *User) (*User, error) {
	if err := s.repo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func validNewPassword(oldPassword, newPassword string) bool {
	if oldPassword == newPassword {
		return false
	}
	if len(newPassword) < 8 {
		return false
	}
	//Contains 1 uppercase, 1 lowercase, 1 number
	hasUpper := false
	hasLower := false
	hasNumber := false
	for _, c := range newPassword {
		switch {
		case 'A' <= c && c <= 'Z':
			hasUpper = true
		case 'a' <= c && c <= 'z':
			hasLower = true
		case '0' <= c && c <= '9':
			hasNumber = true
		}
	}
	if !hasUpper || !hasLower || !hasNumber {
		return false
	}
	return true
}

func (s *Service) ChangePassword(userID string, oldPassword string, newPassword string) error {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return err
	}

	if !validNewPassword(oldPassword, newPassword) {
		return ErrInvalidPassword
	}

	if !security.CheckPassword(oldPassword, user.PasswordHash) {
		return ErrPasswordsDoNotMatch
	}

	newHash, err := security.HashPassword(newPassword)
	if err != nil {
		return err
	}

	user.PasswordHash = newHash
	user.ForceChangePassword = false

	return s.repo.Update(user)
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

// FindByID returns a user by ID
func (s *Service) FindByID(id string) (*User, error) {
	return s.repo.FindByID(id)
}
