package user

import (
	"ResendIt/internal/api/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, h *Handler) {
	auth := r.Group("/user")
	auth.Use(middleware.AuthMiddleware())
	auth.Use(middleware.RequireRole("admin"))

	auth.POST("/change-password", h.ChangePassword)

	//auth.POST("/register", h.Register)
}
