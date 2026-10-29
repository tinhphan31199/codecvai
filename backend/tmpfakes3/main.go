package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
)

type object struct {
	data        []byte
	contentType string
}

func main() {
	var mu sync.Mutex
	objects := map[string]object{}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/")
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			data, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, "read", http.StatusBadRequest)
				return
			}
			objects[key] = object{data: data, contentType: r.Header.Get("Content-Type")}
			log.Printf("PUT %s bytes=%d type=%s", key, len(data), r.Header.Get("Content-Type"))
			w.WriteHeader(http.StatusOK)
		case http.MethodGet:
			obj, ok := objects[key]
			if !ok {
				w.Header().Set("Content-Type", "application/xml")
				w.WriteHeader(http.StatusNotFound)
				_, _ = io.WriteString(w, `<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>missing</Message></Error>`)
				return
			}
			if obj.contentType != "" {
				w.Header().Set("Content-Type", obj.contentType)
			}
			w.Header().Set("Content-Length", fmt.Sprint(len(obj.data)))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(obj.data)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	log.Fatal(http.ListenAndServe("127.0.0.1:9090", nil))
}
