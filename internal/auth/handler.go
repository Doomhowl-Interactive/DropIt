package auth

import (
	"os"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	c.JSON(200, gin.H{
		"user_id": userID,
		"role":    role,
	})
}

func (h *Handler) AdminCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "you are an admin",
	})
}

func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request body"})
		return
	}

	token, err := h.service.Login(req.Username, req.Password)
	if err != nil {
		c.JSON(401, gin.H{"error": "Invalid credentials"})
		return
	}

	isSecure := os.Getenv("USE_HTTPS") == "true"

	c.SetCookie(
		"auth_token",
		token,
		3600*24,
		"/",
		os.Getenv("DOMAIN"),
		isSecure,
		true, // httpOnly (IMPORTANT)
	)

	c.JSON(200, gin.H{"token": token})
}
