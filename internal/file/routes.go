package file

import (
	"ResendIt/internal/api/middleware"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.RouterGroup, h *Handler) {
	files := r.Group("/files")

	files.GET("/download/:id", h.Download)
	files.GET("/view/:id", h.View)

	uploadRoute := files.POST("/upload", h.Upload)
	uploadRoute.Use(middleware.AuthMiddleware())
	uploadRoute.Use(middleware.RequireRole("admin"))

	deleteRoute := files.GET("/delete/:del_id", h.Delete)
	deleteRoute.Use(middleware.AuthMiddleware())
	deleteRoute.Use(middleware.RequireRole("admin"))

	adminRoutes := files.Group("/admin")
	adminRoutes.Use(middleware.AuthMiddleware())
	adminRoutes.Use(middleware.RequireRole("admin"))

	adminRoutes.GET("/", h.AdminList)
	adminRoutes.GET("/:id", h.AdminGet)

	adminRoutes.GET("/download/:id", h.AdminGet)

	adminRoutes.POST("/delete/:id", h.AdminDelete)
	adminRoutes.POST("/delete/fr/:id", h.AdminForceDelete)

	adminRoutes.POST("/import", h.Import)
	adminRoutes.GET("/export", h.Export)
}
