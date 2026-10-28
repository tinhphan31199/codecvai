package cvextract

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"path"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

const (
	MaxCvChars = 60_000
	MinCvChars = 120
)

const docxMIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type Type string

const (
	TypePDF  Type = "pdf"
	TypeDOCX Type = "docx"
)

type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string {
	return e.Message
}

type Result struct {
	Text       string
	Pages      *int
	Characters int
	Truncated  bool
}

var (
	spaceBeforeNewline = regexp.MustCompile(`[ \t]+\n`)
	multipleSpaces     = regexp.MustCompile(`[ \t]{2,}`)
	multipleNewlines   = regexp.MustCompile(`\n{3,}`)
	controlChars       = regexp.MustCompile(`[\x00-\x08\x0B\x0C\x0E-\x1F]`)
)

func Detect(fileName, mimeType string) (Type, bool) {
	name := strings.ToLower(strings.TrimSpace(fileName))
	mime := strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	if mime == "application/pdf" || strings.HasSuffix(name, ".pdf") {
		return TypePDF, true
	}
	if mime == docxMIME || strings.HasSuffix(name, ".docx") {
		return TypeDOCX, true
	}
	return "", false
}

func Extract(buffer []byte, fileType Type) (Result, error) {
	result, err := parse(buffer, fileType)
	if err != nil {
		return Result{}, &Error{
			Code:    "no_text",
			Message: "Không đọc được nội dung tệp. Tệp có thể bị mã hoá, hỏng hoặc không phải PDF/DOCX hợp lệ.",
		}
	}
	if result.Characters < MinCvChars {
		return Result{}, &Error{
			Code:    "no_text",
			Message: "Tệp gần như không có văn bản. Hãy kiểm tra lại nội dung CV trong tệp rồi thử lại.",
		}
	}
	return result, nil
}

// BestEffort trả về văn bản trích được mà không báo lỗi khi tệp scan hoặc hỏng,
// dùng cho luồng PDF được gửi nguyên tệp lên Gemini Files API.
func BestEffort(buffer []byte, fileType Type) Result {
	result, err := parse(buffer, fileType)
	if err != nil {
		return Result{}
	}
	return result
}

func parse(buffer []byte, fileType Type) (Result, error) {
	var (
		raw   string
		pages *int
		err   error
	)

	if fileType == TypePDF {
		raw, pages, err = extractPDF(buffer)
	} else {
		raw, err = extractDOCX(buffer)
	}
	if err != nil {
		return Result{}, err
	}

	text := normalize(raw)
	characters := utf8.RuneCountInString(text)

	truncated := characters > MaxCvChars
	if truncated {
		text = string([]rune(text)[:MaxCvChars])
	}

	return Result{
		Text:       text,
		Pages:      pages,
		Characters: characters,
		Truncated:  truncated,
	}, nil
}

func normalize(raw string) string {
	text := strings.ReplaceAll(raw, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	text = controlChars.ReplaceAllString(text, "")
	text = spaceBeforeNewline.ReplaceAllString(text, "\n")
	text = multipleSpaces.ReplaceAllString(text, " ")
	text = multipleNewlines.ReplaceAllString(text, "\n\n")
	return strings.TrimSpace(text)
}

func extractPDF(buffer []byte) (text string, pages *int, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			text = ""
			pages = nil
			err = errors.New("pdf parser panic")
		}
	}()

	reader, err := pdf.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return "", nil, err
	}

	total := reader.NumPage()
	stream, err := reader.GetPlainText()
	if err != nil {
		return "", nil, err
	}
	data, err := io.ReadAll(io.LimitReader(stream, int64(MaxCvChars*8)))
	if err != nil {
		return "", nil, err
	}

	return string(data), &total, nil
}

func extractDOCX(buffer []byte) (string, error) {
	archive, err := zip.NewReader(bytes.NewReader(buffer), int64(len(buffer)))
	if err != nil {
		return "", err
	}

	var document *zip.File
	for _, entry := range archive.File {
		if path.Clean(entry.Name) == "word/document.xml" {
			document = entry
			break
		}
	}
	if document == nil {
		return "", errors.New("docx: word/document.xml not found")
	}

	file, err := document.Open()
	if err != nil {
		return "", err
	}
	defer file.Close()

	decoder := xml.NewDecoder(io.LimitReader(file, int64(MaxCvChars*16)))
	var builder strings.Builder
	inText := false

	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", err
		}

		switch element := token.(type) {
		case xml.StartElement:
			switch element.Name.Local {
			case "t":
				inText = true
			case "tab":
				builder.WriteString("\t")
			case "br":
				builder.WriteString("\n")
			}
		case xml.EndElement:
			switch element.Name.Local {
			case "t":
				inText = false
			case "p":
				builder.WriteString("\n")
			}
		case xml.CharData:
			if inText {
				builder.Write(element)
			}
		}
	}

	return builder.String(), nil
}
