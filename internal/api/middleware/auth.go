package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		var tokenString string

		cookie, err := c.Cookie("auth_token")
		if err == nil && cookie != "" {
			tokenString = cookie
		}

		if tokenString == "" {
			authHeader := c.GetHeader("Authorization")

			if authHeader != "" {
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					tokenString = parts[1]
				}
			}
		}

		if tokenString == "" {
			abortUnauthorized(c)
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			abortUnauthorized(c)
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)

		c.Next()
	}
}

func abortUnauthorized(c *gin.Context) {
	if strings.Contains(c.GetHeader("Accept"), "text/html") {
		c.Redirect(http.StatusFound, "/login")
	} else {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"error": "unauthorized",
		})
	}
	c.Abort()
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {

		roleValue, exists := c.Get("role")
		if !exists {
			abortForbidden(c)
			return
		}

		userRole, ok := roleValue.(string)
		if !ok {
			abortForbidden(c)
			return
		}

		for _, allowed := range roles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		abortForbidden(c)
	}
}

func abortForbidden(c *gin.Context) {
	if strings.Contains(c.GetHeader("Accept"), "text/html") {
		c.Redirect(http.StatusFound, "/")
	} else {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "forbidden",
		})
	}
	c.Abort()
}
