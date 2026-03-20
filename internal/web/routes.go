package web

import (
	"ResendIt/internal/api/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, h *Handler) {
	r.GET("/", h.Index)
	r.GET("/upload", h.UploadPage)
	r.GET("/login", h.LoginPage)

	adminRoutes := r.Group("/")
	adminRoutes.Use(middleware.AuthMiddleware())
	adminRoutes.Use(middleware.RequireRole("admin"))

	adminRoutes.GET("/admin", h.AdminPage)
	adminRoutes.GET("/logout", h.Logout)
}
