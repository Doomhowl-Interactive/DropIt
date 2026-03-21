package user

import "errors"

var ErrUserNotFound = errors.New("user not found")
var ErrPasswordsDoNotMatch = errors.New("Incorrect old password")
var ErrInvalidPassword = errors.New("invalid password")
