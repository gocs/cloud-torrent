package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"strings"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/gocs/cloud-torrent/engine"
	"github.com/jpillora/velox"
)

func (s *Server) Sync(w http.ResponseWriter, r *http.Request) {
	conn, err := velox.Sync(&s.state, w, r)
	if err != nil {
		log.Printf("sync failed: %s", err)
		return
	}
	s.state.Users[conn.ID()] = r.RemoteAddr
	s.state.Push()
	conn.Wait()
	delete(s.state.Users, conn.ID())
	s.state.Push()
}

// GetTorrentByURL is a handler that accepts a URL string to a torrent file and adds it to the engine.
func (s *Server) GetTorrentByURL(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	url := string(data)
	remote, err := http.Get(url)
	if err != nil {
		slog.Error("remote torrent URL", "err", err)
		http.Error(w, fmt.Sprintf("invalid remote torrent URL: %s (%s)", err, url), http.StatusBadRequest)
		return
	}
	//TODO enforce max body size (32k?)
	data, err = io.ReadAll(remote.Body)
	if err != nil {
		slog.Error("download remote torrent", "err", err)
		http.Error(w, fmt.Sprintf("failed to download remote torrent: %s", err), http.StatusBadRequest)
		return
	}

	if err := parseTorrent(s.engine, data); err != nil {
		slog.Error("parse torrent", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
}

// GetTorrentByFile is a handler that accepts a torrent file and adds it to the engine.
func (s *Server) GetTorrentByFile(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := parseTorrent(s.engine, data); err != nil {
		slog.Error("parse torrent", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
}

type Serverer interface {
	NewTorrent(spec *torrent.TorrentSpec) error
}

func parseTorrent(nt Serverer, data []byte) error {
	//convert torrent bytes into magnet
	reader := bytes.NewBuffer(data)
	info, err := metainfo.Load(reader)
	if err != nil {
		return err
	}
	spec := torrent.TorrentSpecFromMetaInfo(info)
	if err := nt.NewTorrent(spec); err != nil {
		return fmt.Errorf("torrent error: %s", err)
	}
	return nil
}

// Configure is a handler that accepts a JSON configuration and reconfigures the engine.
//
//	{
//		"AutoStart": true,
//		"DisableEncryption": false,
//		"DownloadDirectory": "/path/to/downloads",
//		"EnableUpload": true,
//		"EnableSeeding": true,
//		"EnableUpload": true
//	}
//
//	AutoStart (bool): Start torrents automatically after adding.
//	DisableEncryption (bool): Disable encryption for incoming connections.
//	DownloadDirectory (string): Directory to save downloads.
//	EnableUpload (bool): Enable uploading.
//	EnableSeeding (bool): Enable seeding.
//	EnableUpload (bool): Enable uploading.
func (s *Server) Configure(w http.ResponseWriter, r *http.Request) {
	c := engine.Config{}
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	defer s.state.Push()
	if err := json.Unmarshal(data, &c); err != nil {
		slog.Error("unmarshal", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.reconfigure(c); err != nil {
		slog.Error("reconfigure", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
}

// Magnet is a handler that accepts a magnet URI and adds it to the engine.
func (s *Server) Magnet(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	defer s.state.Push()
	uri := string(data)
	if err := s.engine.NewMagnet(uri); err != nil {
		slog.Error("magnet", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
	}
}

// Torrent is a handler that accepts a torrent infohash and state and performs the action.
//
//	"start:<infohash>"
//	"stop:<infohash>"
//	"delete:<infohash>"
func (s *Server) Torrent(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	defer s.state.Push()
	cmd := strings.SplitN(string(data), ":", 2)
	if len(cmd) != 2 {
		slog.Error("invalid request", "err", err)
		http.Error(w, "cmd format invalid", http.StatusBadRequest)
		return
	}
	state := cmd[0]
	infohash := cmd[1]
	if state == "start" {
		if err := s.engine.StartTorrent(infohash); err != nil {
			slog.Error("start torrent", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else if state == "stop" {
		if err := s.engine.StopTorrent(infohash); err != nil {
			slog.Error("stop torrent", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else if state == "delete" {
		if err := s.engine.DeleteTorrent(infohash); err != nil {
			slog.Error("delete torrent", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		slog.Error("invalid state", "state", state)
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
}

// File is a handler that accepts a file infohash, filepath, and state and performs the action.
//
//	"start:infohash:filepath"
//	"stop:infohash:filepath"
func (s *Server) File(w http.ResponseWriter, r *http.Request) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("read all", "err", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	defer s.state.Push()
	cmd := strings.SplitN(string(data), ":", 3)
	if len(cmd) != 3 {
		slog.Error("invalid request", "err", err)
		http.Error(w, "cmd format invalid", http.StatusBadRequest)
		return
	}
	state := cmd[0]
	infohash := cmd[1]
	filepath := cmd[2]
	if state == "start" {
		if err := s.engine.StartFile(infohash, filepath); err != nil {
			slog.Error("start file", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else if state == "stop" {
		if err := s.engine.StopFile(infohash, filepath); err != nil {
			slog.Error("stop file", "err", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	} else {
		slog.Error("invalid state", "state", state)
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
}
