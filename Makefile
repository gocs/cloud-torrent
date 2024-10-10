.PHONY: tw build run

tw:
	npx tailwindcss -i ./index.css -o ./static/v2/files/css/index.css --watch

build:
	go build -o cloud-torrent ./cmd/v2/main.go

run:
	./cloud-torrent