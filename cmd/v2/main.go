package main

import (
	"log"

	"github.com/gocs/cloud-torrent/server/v2"
	"github.com/jpillora/opts"
)

var version = "0.0.0-src" //set with ldflags

func main() {
	s := server.Server{
		Title:      "Cloud Torrent",
		Port:       3001,
		ConfigPath: "cloud-torrent.json",
	}

	o := opts.New(&s)
	o.Version(version)
	o.PkgRepo()
	o.SetLineWidth(96)
	o.Parse()

	if err := s.Run(version); err != nil {
		log.Fatal(err)
	}
}
