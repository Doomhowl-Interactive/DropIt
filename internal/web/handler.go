package web

import (
	"ResendIt/internal/file"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	fileService *file.Service
}

func NewHandler(fileService *file.Service) *Handler {
	return &Handler{
		fileService: fileService,
	}
}

// Homepage
func (h *Handler) Index(c *gin.Context) {
	c.HTML(200, "index.html", gin.H{
		"title": "Home",
	})
}

// Upload page
func (h *Handler) UploadPage(c *gin.Context) {
	c.HTML(200, "upload.html", nil)
}

func (h *Handler) LoginPage(c *gin.Context) {
	c.HTML(200, "login.html", nil)
}

func (h *Handler) AdminPage(c *gin.Context) {
	pageStr := c.Query("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	limit := 10
	offset := (page - 1) * limit

	files, totalCount, err := h.fileService.GetPaginatedFiles(limit, offset)
	if err != nil {
		c.HTML(500, "admin.html", gin.H{
			"error": err.Error(),
		})
		return
	}

	totalPages := (totalCount + limit - 1) / limit

	c.HTML(200, "admin.html", gin.H{
		"Files":      files,
		"Page":       page,
		"TotalPages": totalPages,
	})
}

func (h *Handler) Logout(c *gin.Context) {
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.Redirect(302, "/")
}

func (h *Handler) ChangePasswordPage(c *gin.Context) {
	c.HTML(200, "changePassword.html", nil)
}
