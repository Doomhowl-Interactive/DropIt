package user

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	user, err := h.service.CreateUser(req.Username, req.Password, req.Role)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(201, gin.H{"id": user.ID, "username": user.Username, "role": user.Role})
}

func (h *Handler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	userID, exists := c.Get("user_id")
	if !exists {
		fmt.Println("User ID not found in context")
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	err := h.service.ChangePassword(userID.(string), req.OldPassword, req.NewPassword)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"message": "password changed successfully"})
}

func ForcePasswordChangeMiddleware(userService *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.Next()
			return
		}

		user, err := userService.FindByID(userID.(string))
		if err != nil {
			c.AbortWithStatus(500)
			return
		}

		// Allow access to change password page itself
		if user.ForceChangePassword && c.Request.URL.Path != "/change-password" {
			c.Redirect(302, "/change-password")
			c.Abort()
			return
		}

		c.Next()
	}
}
