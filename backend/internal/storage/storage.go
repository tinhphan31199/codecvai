// Package storage lưu bản gốc CV trên bucket S3-compatible (Neon Object Storage).
// Bucket là private; chỉ backend giữ credential, frontend không bao giờ nhận key.
package storage

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

// ErrNotFound báo object không tồn tại (hoặc đã bị xoá) trên bucket.
var ErrNotFound = errors.New("storage: object not found")

// Config là thông tin kết nối bucket, lấy từ biến môi trường.
type Config struct {
	Endpoint  string
	Region    string
	AccessKey string
	SecretKey string
	Bucket    string
}

func (c Config) complete() bool {
	return c.Endpoint != "" && c.Region != "" && c.AccessKey != "" &&
		c.SecretKey != "" && c.Bucket != ""
}

// Client đọc/ghi object trên bucket private.
type Client struct {
	s3     *s3.Client
	bucket string
}

// Object là file đọc từ bucket; người gọi phải đóng Body.
type Object struct {
	Body        io.ReadCloser
	ContentType string
	Size        int64
}

// New dựng client S3 trỏ vào endpoint riêng (Neon) với path-style addressing.
func New(ctx context.Context, cfg Config) (*Client, error) {
	if !cfg.complete() {
		return nil, errors.New("storage: missing endpoint, region, credentials or bucket")
	}
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.Region),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: load config: %w", err)
	}
	client := s3.NewFromConfig(awsCfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(cfg.Endpoint)
		options.UsePathStyle = true
	})
	return &Client{s3: client, bucket: cfg.Bucket}, nil
}

// FromEnv trả nil khi thiếu cấu hình; phân tích CV vẫn chạy bình thường.
func FromEnv(ctx context.Context) *Client {
	cfg := Config{
		Endpoint:  strings.TrimSpace(os.Getenv("AWS_ENDPOINT_URL_S3")),
		Region:    strings.TrimSpace(os.Getenv("AWS_REGION")),
		AccessKey: strings.TrimSpace(os.Getenv("AWS_ACCESS_KEY_ID")),
		SecretKey: strings.TrimSpace(os.Getenv("AWS_SECRET_ACCESS_KEY")),
		Bucket:    strings.TrimSpace(os.Getenv("S3_BUCKET")),
	}
	if !cfg.complete() {
		return nil
	}
	client, err := New(ctx, cfg)
	if err != nil {
		return nil
	}
	return client
}

// Put ghi đè object tại key với nội dung cho trước.
func (c *Client) Put(ctx context.Context, key, contentType string, body []byte) error {
	_, err := c.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(body),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("storage: put: %w", err)
	}
	return nil
}

// Get mở object để backend stream thẳng cho người dùng.
func (c *Client) Get(ctx context.Context, key string) (Object, error) {
	out, err := c.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) {
			switch apiErr.ErrorCode() {
			case "NoSuchKey", "NotFound", "NoSuchBucket":
				return Object{}, ErrNotFound
			}
		}
		return Object{}, fmt.Errorf("storage: get: %w", err)
	}
	return Object{
		Body:        out.Body,
		ContentType: aws.ToString(out.ContentType),
		Size:        aws.ToInt64(out.ContentLength),
	}, nil
}

// Key tạo object key do server sinh: cv/<random>/<tên file đã làm sạch>.
// Không dùng trực tiếp đường dẫn do client gửi lên.
func Key(fileName string) (string, error) {
	name := filepath.Base(strings.ReplaceAll(fileName, "\\", "/"))
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || name == "/" {
		return "", fmt.Errorf("storage: invalid file name %q", fileName)
	}
	var random [8]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", fmt.Errorf("storage: random key: %w", err)
	}
	return "cv/" + hex.EncodeToString(random[:]) + "/" + name, nil
}
