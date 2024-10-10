package server

import (
	"fmt"
)

var (
	ErrorInvalidRequestMethod = fmt.Errorf("invalid request method (expecting POST)")
	ErrorInvalidRequest       = fmt.Errorf("invalid request")
)
