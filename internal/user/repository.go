package user

import (
	"errors"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) FindByUsername(username string) (*User, error) {
	var u User
	if err := r.db.Where("username = ?", username).First(&u).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) FindByID(id string) (*User, error) {
	var u User
	if err := r.db.First(&u, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *Repository) Create(u *User) error {
	return r.db.Create(u).Error
}

func (r *Repository) GetAll() ([]User, error) {
	var users []User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *Repository) Update(u *User) error {
	return r.db.Save(u).Error
}

func (r *Repository) Delete(id uint) error {
	return r.db.Delete(&User{}, id).Error
}
