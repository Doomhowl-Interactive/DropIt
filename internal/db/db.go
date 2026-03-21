package db

import (
	"fmt"
	"os"
	"path/filepath"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func Connect() (*gorm.DB, error) {
	dbType := os.Getenv("DB_TYPE")
	if dbType == "" {
		dbType = "sqlite"
	}
	dsn := os.Getenv("DATABASE_URL")
	if dbType == "sqlite" && dsn == "" {
		dsn = "./data/database.db"
	}

	switch dbType {
	case "sqlite":
		return connectSQLite(dsn)

	case "postgres":
		return connectPostgres(dsn)

	case "mysql":
		return connectMySQL(dsn)

	default:
		return nil, fmt.Errorf("unsupported DB_TYPE: %s", dbType)
	}
}

func connectSQLite(filePath string) (*gorm.DB, error) {
	if filePath == "" {
		filePath = "./data.db"
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	db, err := gorm.Open(sqlite.Open(filePath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open SQLite database: %w", err)
	}

	return db, nil
}

func connectPostgres(dsn string) (*gorm.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required for postgres")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Postgres: %w", err)
	}

	return db, nil
}

func connectMySQL(dsn string) (*gorm.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required for mysql")
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MySQL: %w", err)
	}

	return db, nil
}
