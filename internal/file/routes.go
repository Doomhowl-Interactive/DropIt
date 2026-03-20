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

	adminRoutes := files.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware())
	adminRoutes.Use(middleware.RequireRole("admin"))

	adminRoutes.GET("/", h.AdminList)
	adminRoutes.GET("/:id", h.AdminGet)

	adminRoutes.GET("/download/:id", h.AdminGet)

	adminRoutes.GET("/delete/:id", h.AdminDelete)
	adminRoutes.GET("/delete/fr/:id", h.AdminForceDelete)

	adminRoutes.POST("/import", h.Import)
	adminRoutes.GET("/export", h.Export)
}
