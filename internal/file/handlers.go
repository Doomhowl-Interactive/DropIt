package file

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) Upload(c *gin.Context) {
	err := c.Request.ParseMultipartForm(0)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot open file"})
		return
	}
	defer f.Close()

	once := c.PostForm("once") == "true"

	durationStr := c.PostForm("duration")
	hours, err := strconv.Atoi(durationStr)
	if err != nil || hours <= 0 {
		hours = 24 // default
	}

	duration := time.Duration(hours) * time.Hour

	record, err := h.service.UploadFile(
		file.Filename,
		f,
		once,
		duration,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          record.ID,
		"deletion_id": record.DeletionID,
		"filename":    record.Filename,
		"size":        record.Size,
		"expires_at":  record.ExpiresAt,
	})
}

func (h *Handler) Download(c *gin.Context) {
	id := c.Param("id")

	record, err := h.service.DownloadFile(id)
	if err != nil {
		c.HTML(http.StatusOK, "fileNotFound.html", nil)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, record.Filename))
	c.File(record.Path)
}

func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("del_id")

	_, err := h.service.DeleteFileByDeletionID(id)
	if err != nil {
		c.HTML(http.StatusOK, "fileNotFound.html", nil)
		return
	}

	//c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	c.HTML(http.StatusOK, "deleted.html", nil)
}

func (h *Handler) AdminList(c *gin.Context) {
	records, err := h.service.repo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

func (h *Handler) AdminGet(c *gin.Context) {
	id := c.Param("id")

	record, err := h.service.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	c.File(record.Path)
}

func (h *Handler) AdminDelete(c *gin.Context) {
	id := c.Param("id")

	_, err := h.service.DeleteFileByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	c.Redirect(301, "/admin")
}

func (h *Handler) AdminForceDelete(c *gin.Context) {
	id := c.Param("id")

	_, err := h.service.GetFileByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	if _, err := h.service.ForceDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Redirect(301, "/admin")
}
