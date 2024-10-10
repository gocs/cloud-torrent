package web

import (
	"compress/gzip"
	"errors"
	"fmt"
	"log"
	"net/http"

	"github.com/NYTimes/gziphandler"
	"github.com/jpillora/cookieauth"
	"github.com/jpillora/requestlog"
)

type WebConfig func(s *Web) error

func WithHost(host string) WebConfig {
	return func(w *Web) error {
		w.Host = host
		return nil
	}
}
func WithPort(port int) WebConfig {
	return func(w *Web) error {
		w.Port = port
		return nil
	}
}

var (
	ErrRequiredKeyCert = errors.New("you must provide both key and cert paths")
)

// WithCertKeyPath sets the cert and key paths for TLS
func WithCertKeyPath(certPath, keyPath string) WebConfig {
	return func(w *Web) error {
		isTLS := certPath != "" || keyPath != "" //poor man's XOR
		if isTLS && (certPath == "" || keyPath == "") {
			return ErrRequiredKeyCert
		}
		w.isTLS = isTLS
		if isTLS {
			w.Proto += "s"
			w.server = func(s *http.Server) error {
				return s.ListenAndServeTLS(certPath, keyPath)
			}
		}
		return nil
	}
}

func WithAuth(user, pass string) WebConfig {
	return func(w *Web) error {
		w.Auth = cookieauth.New().SetUserPass(user, pass)
		w.r = w.Auth.Wrap(w.r)
		log.Printf("Enabled HTTP authentication")
		return nil
	}
}

func WithLogging() WebConfig {
	return func(w *Web) error {
		w.r = requestlog.Wrap(w.r)
		log.Printf("Enabled Logging")
		return nil
	}
}

func WithGzip() WebConfig {
	return func(w *Web) error {
		compression := gzip.DefaultCompression
		minSize := 0 //IMPORTANT
		gzipWrap, err := gziphandler.NewGzipLevelAndMinSize(compression, minSize)
		if err != nil {
			return fmt.Errorf("failed to enable gzip: %s", err)
		}
		w.r = gzipWrap(w.r)
		log.Printf("Enabled Gzip")
		return nil
	}
}
