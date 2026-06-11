---
title: Web API
draft: false
tags:
  -
---
```go
package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
)


type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}


var (
	mu      sync.RWMutex
	store   = map[int64]*User{}
	counter int64
)


func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func pathID(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(r.PathValue(key), 10, 64)
}


// POST /users
func createUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if body.Name == "" || body.Email == "" {
		writeError(w, http.StatusUnprocessableEntity, "name and email are required")
		return
	}

	mu.Lock()
	counter++
	u := &User{ID: counter, Name: body.Name, Email: body.Email, CreatedAt: time.Now()}
	store[u.ID] = u
	mu.Unlock()

	writeJSON(w, http.StatusCreated, u)
}

// GET /users
func listUsers(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	users := make([]*User, 0, len(store))
	for _, u := range store {
		users = append(users, u)
	}
	mu.RUnlock()

	writeJSON(w, http.StatusOK, users)
}

// GET /users/{id}
func getUser(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	mu.RLock()
	u, ok := store[id]
	mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

// DELETE /users/{id}
func deleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r, "id")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	mu.Lock()
	_, ok := store[id]
	if ok {
		delete(store, id)
	}
	mu.Unlock()

	if !ok {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	mux := http.NewServeMux()
	mux.HandleFunc("POST /users", createUser)
	mux.HandleFunc("GET /users", listUsers)
	mux.HandleFunc("GET /users/{id}", getUser)
	mux.HandleFunc("DELETE /users/{id}", deleteUser)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	addr := ":" + getEnv("PORT", "8080")
	log.Info("starting", "addr", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```