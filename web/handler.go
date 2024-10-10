package web

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/http"

	"github.com/jpillora/cookieauth"
)


type Web struct {
	r      http.Handler
	server func(s *http.Server) error

	Proto    string
	Host     string
	Port     int
	Addr     string
	CertPath string
	KeyPath  string
	Auth     *cookieauth.CookieAuth
	isTLS    bool
}

type HandleHandlerer interface {
	http.Handler
	HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request))
}

func NewWeb(r HandleHandlerer, configs ...WebConfig) error {

	// init mux
	w := &Web{
		r: r,
		server: func(s *http.Server) error {
			return s.ListenAndServe()
		},
		Proto: "http",
		Host:  "0.0.0.0",
		Port:  80,
	}
	for _, config := range configs {
		if err := config(w); err != nil {
			return fmt.Errorf("failed to apply config: %s", err)
		}
	}

	w.Addr = fmt.Sprintf("%s:%d", w.Host, w.Port)
	// serve!
	s := http.Server{
		//disable http2 due to velox bug
		TLSNextProto: map[string]func(*http.Server, *tls.Conn, http.Handler){},
		//address
		Addr: w.Addr,
		//handler stack
		Handler: w.r,
	}
	log.Printf("Listening at %s://%s", w.Proto, w.Addr)
	if err := w.server(&s); err != nil {
		return fmt.Errorf("failed to start server: %s", err)
	}
	return nil
}
