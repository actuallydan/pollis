package main

import (
	"embed"
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Load environment variables from .env.local in project root if present
	if err := godotenv.Load(".env.local"); err == nil {
		fmt.Println("Loaded environment from .env.local")
	}

	// Optional: allow overriding from OS environment as usual
	_ = os.Getenv("CLERK_SECRET_KEY")

	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:             "Pollis",
		Width:             1280,
		Height:            800,
		MinWidth:          300,
		MinHeight:         600,
		Frameless:         true, // Frameless window for transparent title bar
		StartHidden:       false,
		HideWindowOnClose: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		// App icon is automatically loaded from build/appicon.png
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
