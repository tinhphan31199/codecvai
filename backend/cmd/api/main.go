package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"codecv/backend/internal/api"
	"codecv/backend/internal/config"
	"codecv/backend/internal/store"
)

func main() {
	config.LoadDotEnv(".env.local", ".env")

	port := env("PORT", "8080")

	dsn := env("DATABASE_URL", "postgres://codecv:codecv@localhost:5433/codecv?sslmode=disable")
	var dataStore *store.Store
	if dsn != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		var err error
		dataStore, err = store.Open(ctx, dsn)
		cancel()
		if err != nil {
			log.Printf("warning: cannot connect database (%v); screen APIs will return 503", err)
		} else {
			if err := dataStore.Migrate(context.Background()); err != nil {
				log.Printf("warning: migration failed: %v", err)
			} else if err := dataStore.Seed(context.Background()); err != nil {
				log.Printf("warning: seeding failed: %v", err)
			} else {
				log.Print("database ready (migrated + seeded)")
			}
		}
	}

	server := &http.Server{
		Addr: ":" + port,
		Handler: api.New(api.Config{
			AllowedOrigins: splitList(env("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")),
			Store:          dataStore,
		}),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      160 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	go func() {
		log.Printf("CodeCV API listening on http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("api: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("api: shutdown error: %v", err)
	}
	if dataStore != nil {
		dataStore.Close()
	}
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func splitList(value string) []string {
	parts := strings.Split(value, ",")
	kept := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			kept = append(kept, trimmed)
		}
	}
	return kept
}
