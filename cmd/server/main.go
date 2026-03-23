package main

import (
	"ResendIt/internal/api/middleware"
	"ResendIt/internal/auth"
	"ResendIt/internal/db"
	"ResendIt/internal/file"
	"ResendIt/internal/user"
	"ResendIt/internal/util"
	"ResendIt/internal/web"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Printf("Error loading .env file\n")
	}

	dbCon, err := db.Connect()
	if err != nil {
		panic(fmt.Errorf("failed to connect database: %w", err))
	}

	err = dbCon.AutoMigrate(&user.User{}, &file.FileRecord{})
	if err != nil {
		fmt.Printf("Error migrating database: %v\n", err)
		return
	}

	r := gin.Default()

	// CSRF: set a token cookie for browsers and enforce it on unsafe /api calls.
	r.Use(middleware.EnsureCSRFCookie())

	r.MaxMultipartMemory = 10 << 30
	r.SetFuncMap(template.FuncMap{
		"add":       func(a, b int) int { return a + b },
		"sub":       func(a, b int) int { return a - b },
		"humanSize": util.HumanSize,
	})

	r.LoadHTMLGlob("templates/*.html")
	//r.LoadHTMLGlob("internal/templates/new/*.html")
	r.Static("/static", "./static")

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "hello",
		})
	})

	r.NoRoute(func(c *gin.Context) {
		c.HTML(404, "error.html", nil)
	})

	authRepo := auth.NewRepository(dbCon)
	authService := auth.NewService(authRepo)
	authHandler := auth.NewHandler(authService)

	userRepo := user.NewRepository(dbCon)
	userService := user.NewService(userRepo)
	userHandler := user.NewHandler(userService)

	fileRepo := file.NewRepository(dbCon)
	fileService := file.NewService(fileRepo, "./uploads")
	fileHandler := file.NewHandler(fileService)

	createAdminUser(userService)

	apiRoute := r.Group("/api")
	apiRoute.Use(middleware.CSRFMiddleware())

	auth.RegisterRoutes(apiRoute, authHandler)
	user.RegisterRoutes(apiRoute, userHandler)
	file.RegisterRoutes(apiRoute, fileHandler)

	webHandler := web.NewHandler(fileService)
	web.RegisterRoutes(r, webHandler, userService)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	err = r.Run(":" + port)
	if err != nil {
		return
	}
}

func generateRandomPassword(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.URLEncoding.EncodeToString(b)[:length]
}

func createAdminUser(service *user.Service) {
	_, err := service.FindByUsername("admin")

	if err == nil {
		fmt.Println("Admin user already exists, skipping creation")
		return
	} else if errors.Is(err, user.ErrUserNotFound) {
		fmt.Println("Admin user not found, creating new admin user")

		password := generateRandomPassword(16)
		adminUser, err := service.CreateUser("admin", password, "admin")
		if err != nil {
			fmt.Printf("Error creating admin user: %v\n", err)
			return
		}

		adminUser.ForceChangePassword = true
		_, err = service.UpdateUser(adminUser)

		if err != nil {
			fmt.Printf("Error creating admin user: %v\n", err)
		} else {
			fmt.Printf("Admin user created with random password: %s\n", password)
		}
		return
	}

	fmt.Printf("Error checking for admin user: %v\n", err)
	return
}
