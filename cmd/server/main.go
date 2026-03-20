package main

import (
	"ResendIt/internal/auth"
	"ResendIt/internal/db"
	"ResendIt/internal/file"
	"ResendIt/internal/user"
	"ResendIt/internal/util"
	"ResendIt/internal/web"
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
		fmt.Printf("Error loading .env file")
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

	r.MaxMultipartMemory = 10 << 30
	r.SetFuncMap(template.FuncMap{
		"add":       func(a, b int) int { return a + b },
		"sub":       func(a, b int) int { return a - b },
		"humanSize": util.HumanSize,
	})

	r.LoadHTMLGlob("templates/*.html")
	//r.LoadHTMLGlob("internal/templates/new/*.html")
	r.Static("/static", "/static")

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

	auth.RegisterRoutes(apiRoute, authHandler)
	user.RegisterRoutes(apiRoute, userHandler)
	file.RegisterRoutes(apiRoute, fileHandler)

	webHandler := web.NewHandler(fileService)
	web.RegisterRoutes(r, webHandler)

	err = r.Run(":" + os.Getenv("PORT"))
	if err != nil {
		return
	}
}

func createAdminUser(service *user.Service) {
	//Check if admin user already exists
	_, err := service.FindByUsername("admin")
	if err == nil {
		fmt.Println("Admin user already exists, skipping creation")
		return
	} else if !errors.Is(err, user.ErrUserNotFound) {
		fmt.Printf("Error checking for admin user: %v\n", err)
		return
	}

	adminPassword, exists := os.LookupEnv("ADMIN_PASSWORD")
	if !exists || adminPassword == "" {
		fmt.Println("ADMIN_PASSWORD not set in environment variables")
		fmt.Println("NO ADMIN ACCOUNT WILL BE CREATED")
		return
	}

	_, err = service.CreateUser("admin", adminPassword, "admin")
	if err != nil {
		fmt.Printf("Error creating admin user: %v\n", err)
	} else {
		fmt.Println("Admin user created successfully")
	}
}
