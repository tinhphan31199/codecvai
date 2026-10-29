package gateway

import (
	"context"
	"errors"
	"fmt"
	"log"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/cvextract"
	"codecv/backend/internal/gemini"
	"codecv/backend/internal/model"
)

func (g *Gateway) analyzeGoogle(ctx context.Context, target upstream, input analysis.Input, req Request) (model.Analysis, error) {
	client := gemini.New(target.baseURL, target.key)

	if len(req.CVFile) > 0 {
		name := req.CVFileName
		if name == "" {
			name = "cv.pdf"
		}
		uploaded, err := client.UploadFile(ctx, name, "application/pdf", req.CVFile)
		switch {
		case err != nil && len([]rune(req.CVText)) < cvextract.MinCvChars:
			return model.Analysis{}, fromGeminiError(err)
		case err != nil:
			log.Printf("[gateway] %s upload failed, using extracted text: %v", target.provider, err)
		default:
			input.CVFileURI = uploaded.URI
			input.CVFileMime = uploaded.MimeType
			input.CVAttached = true
		}
	}

	result, err := client.Analyze(ctx, gemini.Input{Input: input, Model: target.modelID})
	if err != nil {
		return model.Analysis{}, fromGeminiError(err)
	}
	return result, nil
}

func fromGeminiError(err error) *Error {
	var geminiErr *gemini.Error
	if errors.As(err, &geminiErr) {
		return &Error{Code: geminiErr.Code, Message: geminiErr.Message}
	}
	return &Error{Code: "server_error", Message: fmt.Sprintf("Google gặp lỗi khi phân tích: %v", err)}
}
