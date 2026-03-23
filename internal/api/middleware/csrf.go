package middleware

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// EnsureCSRFCookie sets a csrf_token cookie if it's missing.
//
// Uses SameSite=Strict to reduce cross-site cookie sending.
// HttpOnly must be false so browser JS can read it and send it back in a header.
func EnsureCSRFCookie() gin.HandlerFunc {
	return func(c *gin.Context) {
		if tok, err := c.Cookie("csrf_token"); err != nil || tok == "" {
			if tok, err := randomToken(32); err == nil {
				secure := os.Getenv("USE_HTTPS") == "true"
				http.SetCookie(c.Writer, &http.Cookie{
					Name:     "csrf_token",
					Value:    tok,
					Path:     "/",
					Secure:   secure,
					HttpOnly: false,
					SameSite: http.SameSiteStrictMode,
				})
			}
		}
		c.Next()
	}
}

// CSRFMiddleware enforces CSRF checks on unsafe methods for cookie-authenticated requests.
//
// - Skips safe methods (GET/HEAD/OPTIONS).
// - Skips requests using Authorization: Bearer (non-cookie API clients).
// - Enforces only when auth_token cookie is present (browser session).
//
// Validation uses the double-submit cookie pattern:
// cookie csrf_token must match X-CSRF-Token header OR _csrf form field.
func CSRFMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		m := c.Request.Method
		if m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions {
			c.Next()
			return
		}

		if strings.HasPrefix(c.GetHeader("Authorization"), "Bearer ") {
			c.Next()
			return
		}

		// Only enforce when cookie auth is in play
		if _, err := c.Cookie("auth_token"); err != nil {
			c.Next()
			return
		}

		// Extra hardening: basic Origin check when present.
		if origin := c.GetHeader("Origin"); origin != "" {
			host := c.Request.Host
			if !strings.Contains(origin, host) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "csrf origin blocked"})
				return
			}
		}

		cookieTok, err := c.Cookie("csrf_token")
		if err != nil || cookieTok == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "missing csrf cookie"})
			return
		}

		reqTok := c.GetHeader("X-CSRF-Token")
		if reqTok == "" {
			reqTok = c.PostForm("_csrf")
		}

		if reqTok == "" || reqTok != cookieTok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "bad csrf token"})
			return
		}

		c.Next()
	}
}
