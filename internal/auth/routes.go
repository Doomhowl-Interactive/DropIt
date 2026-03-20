package auth

import (
	"ResendIt/internal/api/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, h *Handler) {
	auth := r.Group("/auth")

	auth.POST("/login", h.Login)

	protected := auth.Group("/")
	protected.Use(middleware.AuthMiddleware())

	protected.GET("/me", h.Me)

	admin := protected.Group("/")
	admin.Use(middleware.RequireRole("admin"))

	admin.GET("/admin-check", h.AdminCheck)
}
