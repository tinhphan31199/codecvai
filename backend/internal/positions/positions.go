package positions

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed positions.json
var raw []byte

type Criterion struct {
	Label string `json:"label"`
	Kind  string `json:"kind"`
}

type Position struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Team        string      `json:"team"`
	Level       string      `json:"level"`
	Description string      `json:"description"`
	Criteria    []Criterion `json:"criteria"`
}

var all []Position

func init() {
	if err := json.Unmarshal(raw, &all); err != nil {
		panic(fmt.Sprintf("positions: cannot parse positions.json: %v", err))
	}
}

func All() []Position {
	return all
}

func Find(id string) (Position, bool) {
	for _, position := range all {
		if position.ID == id {
			return position, true
		}
	}
	return Position{}, false
}
