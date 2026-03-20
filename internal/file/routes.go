package file

import (
	"ResendIt/internal/api/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, h *Handler) {
	files := r.Group("/files")

	files.POST("/upload", h.Upload)
	files.GET("/download/:id", h.Download)

	files.GET("/delete/:del_id", h.Delete)

	adminRoutes := files.Group("/")
	adminRoutes.Use(middleware.AuthMiddleware())
	adminRoutes.Use(middleware.RequireRole("admin"))

	adminRoutes.GET("/admin", h.AdminList)
	adminRoutes.GET("/admin/:id", h.AdminGet)

	adminRoutes.GET("/admin/download/:id", h.AdminGet)

	adminRoutes.GET("/admin/delete/:id", h.AdminDelete)
	adminRoutes.GET("/admin/delete/fr/:id", h.AdminForceDelete)
}
