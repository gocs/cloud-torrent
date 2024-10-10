package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gocs/cloud-torrent/engine"
	ctstatic "github.com/gocs/cloud-torrent/static/v2"
	"github.com/gocs/cloud-torrent/web"
	"github.com/jpillora/scraper/scraper"
	"github.com/jpillora/velox"
)

type Server struct {
	//config
	Title      string `help:"Title of this instance" env:"TITLE"`
	Port       int    `help:"Listening port" env:"PORT"`
	Host       string `help:"Listening interface (default all)"`
	Auth       string `help:"Optional basic auth in form 'user:password'" env:"AUTH"`
	ConfigPath string `help:"Configuration file path"`
	KeyPath    string `help:"TLS Key file path"`
	CertPath   string `help:"TLS Certicate file path" short:"r"`
	Log        bool   `help:"Enable request logging"`
	Open       bool   `help:"Open now with your default browser"`
	//http handlers
	static   http.Handler
	scraper  *scraper.Handler
	scraperh http.Handler
	//torrent engine
	engine *engine.Engine
	state  State
}

type State struct {
	velox.State
	sync.Mutex
	Config          engine.Config
	SearchProviders scraper.Config
	Downloads       *fsNode
	Torrents        map[string]*engine.Torrent
	Users           map[string]string
	Stats           struct {
		Title   string
		Version string
		Runtime string
		Uptime  time.Time
		System  stats
	}
}

var (
	ErrRequiredKeyCert = errors.New("you must provide both key and cert paths")
)

// Run the server
func (s *Server) Run(version string) error {
	isTLS := s.CertPath != "" || s.KeyPath != "" //poor man's XOR
	if isTLS && (s.CertPath == "" || s.KeyPath == "") {
		return ErrRequiredKeyCert
	}
	s.state.Stats.Title = s.Title
	s.state.Stats.Version = version
	s.state.Stats.Runtime = strings.TrimPrefix(runtime.Version(), "go")
	s.state.Stats.Uptime = time.Now()
	s.state.Stats.System.pusher = velox.Pusher(&s.state)
	//init maps
	s.state.Users = map[string]string{}
	//will use a the local embed/ dir if it exists, otherwise will use the hardcoded embedded binaries
	static := ctstatic.FileSystemHandler()

	s.static = static
	s.scraper = &scraper.Handler{
		Log: false, Debug: false,
		Headers: map[string]string{
			//we're a trusty browser :)
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36",
		},
	}
	if err := s.scraper.LoadConfig(defaultSearchConfig); err != nil {
		return fmt.Errorf("load config error: %w", err)
	}
	//scraper
	s.state.SearchProviders = s.scraper.Config //share scraper config
	go s.fetchSearchConfigLoop()
	s.scraperh = http.StripPrefix("/search", s.scraper)
	//torrent engine
	s.engine = engine.New()
	//configure engine
	c := engine.Config{
		DownloadDirectory: "./downloads",
		EnableUpload:      true,
		AutoStart:         true,
	}
	if _, err := os.Stat(s.ConfigPath); err == nil {
		if b, err := os.ReadFile(s.ConfigPath); err != nil {
			return fmt.Errorf("read configuration error: %w", err)
		} else if len(b) == 0 {
			//ignore empty file
		} else if err := json.Unmarshal(b, &c); err != nil {
			return fmt.Errorf("malformed configuration: %w", err)
		}
	}
	if c.IncomingPort <= 0 || c.IncomingPort >= 65535 {
		c.IncomingPort = 50007
	}
	if err := s.reconfigure(c); err != nil {
		return fmt.Errorf("initial configure failed: %s", err)
	}
	//poll torrents and files
	go func() {
		for {
			s.state.Lock()
			s.state.Torrents = s.engine.GetTorrents()
			s.state.Downloads = s.listFiles()
			s.state.Unlock()
			s.state.Push()
			time.Sleep(1 * time.Second)
		}
	}()
	//start collecting stats
	go func() {
		for {
			c := s.engine.Config()
			s.state.Stats.System.loadStats(c.DownloadDirectory)
			time.Sleep(5 * time.Second)
		}
	}()

	configs := []web.WebConfig{
		web.WithHost(s.Host),
		web.WithPort(s.Port),
	}

	if s.Auth != "" {
		user := s.Auth
		pass := ""
		if s := strings.SplitN(s.Auth, ":", 2); len(s) == 2 {
			user = s[0]
			pass = s[1]
		}
		configs = append(configs, web.WithAuth(user, pass))
		log.Printf("Enabled HTTP authentication")
	}

	if s.Log {
		configs = append(configs, web.WithLogging())
	}

	if isTLS {
		configs = append(configs, web.WithCertKeyPath(s.CertPath, s.KeyPath))
	}
	r := http.NewServeMux()
	r.HandleFunc("GET /sync", s.Sync)
	r.HandleFunc("POST /api/url", s.GetTorrentByURL)
	r.HandleFunc("POST /api/torrentfile", s.GetTorrentByFile)
	r.HandleFunc("POST /api/configure", s.Configure)
	r.HandleFunc("POST /api/magnet", s.Magnet)
	r.HandleFunc("POST /api/torrent", s.Torrent)
	r.HandleFunc("POST /api/file", s.File)
	r.HandleFunc("/", s.ServeFiles)
	r.HandleFunc("/js/velox.js", velox.JS)
	r.HandleFunc("POST /search", Scraper())

	configs = append(configs, web.WithGzip())
	return web.NewWeb(r, configs...)
}

var (
	ErrInvalidPath = errors.New("invalid path")
)

func (s *Server) reconfigure(c engine.Config) error {
	dldir, err := filepath.Abs(c.DownloadDirectory)
	if err != nil {
		return ErrInvalidPath
	}
	c.DownloadDirectory = dldir
	if err := s.engine.Configure(c); err != nil {
		return fmt.Errorf("engine configure error: %w", err)
	}
	b, err := json.MarshalIndent(&c, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config error: %w", err)
	}
	if err := os.WriteFile(s.ConfigPath, b, 0755); err != nil {
		return fmt.Errorf("write config error: %w", err)
	}
	s.state.Config = c
	s.state.Push()
	return nil
}

func Scraper() http.HandlerFunc {
	scrape := &scraper.Handler{
		Log: false, Debug: false,
		Headers: map[string]string{
			//we're a trusty browser :)
			"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36",
		},
	}
	scrape.LoadConfig(SearchConfig())
	return http.StripPrefix("/search", scrape).ServeHTTP
}
