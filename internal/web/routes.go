package web

import (
	"ResendIt/internal/api/middleware"
	"ResendIt/internal/user"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine, h *Handler, userService *user.Service) {
	r.GET("/", h.Index)
	//r.GET("/upload", h.UploadPage)
	r.GET("/login", h.LoginPage)

	adminRoutes := r.Group("/")
	adminRoutes.Use(middleware.AuthMiddleware())
	adminRoutes.Use(middleware.RequireRole("admin"))
	adminRoutes.Use(user.ForcePasswordChangeMiddleware(userService))

	adminRoutes.GET("/admin", h.AdminPage)
	adminRoutes.GET("/logout", h.Logout)
	adminRoutes.GET("/change-password", h.ChangePasswordPage)
}
