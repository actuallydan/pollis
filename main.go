package main

import (
	"embed"
	"fmt"
	"os"
	"runtime"

	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
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

	// Platform-specific window configuration
	// macOS: Use framed window with minimal titlebar (App Store compatible)
	// Linux: Use frameless (Linux titlebars are inconsistent across distros)
	frameless := runtime.GOOS != "darwin"

	appOptions := &options.App{
		Title:             "Pollis",
		Width:             1280,
		Height:            720,
		MinWidth:          300,
		MinHeight:         600,
		Frameless:         frameless,
		StartHidden:       false,
		HideWindowOnClose: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		// App icon is automatically loaded from build/appicon.png
	}

	// macOS-specific: Customize titlebar appearance
	if runtime.GOOS == "darwin" {
		appOptions.Mac = &mac.Options{
			TitleBar: &mac.TitleBar{
				TitlebarAppearsTransparent: true,
				HideTitle:                  true,
				HideTitleBar:               false,
				FullSizeContent:            true,
				UseToolbar:                 false,
				HideToolbarSeparator:       true,
			},
			WebviewIsTransparent: true,
			WindowIsTranslucent:  false,
		}
	}

	// Create application with options
	err := wails.Run(appOptions)

	if err != nil {
		println("Error:", err.Error())
	}
}
