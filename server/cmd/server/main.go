package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"pollis-service/internal/database"
	"pollis-service/internal/handlers"
	"pollis-service/internal/services"
	"pollis/pkg/proto"

	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

var (
	port             = flag.Int("port", 50051, "The gRPC server port")
	httpPort         = flag.Int("http-port", 8081, "The HTTP/gRPC-web server port")
	dbURL            = flag.String("db", "", "Database URL (libsql://file.db or libsql://host:port?authToken=...)")
	enableReflection = flag.Bool("reflection", true, "Enable gRPC reflection")
	enableCORS       = flag.Bool("cors", true, "Enable CORS for web clients")
)

func main() {
	// Load environment variables from the shared root .env.local if present
	_ = godotenv.Load("../.env.local")

	flag.Parse()

	// If -db flag is not provided, try environment variables
	if *dbURL == "" {
		// 1) DB_URL takes precedence if set
		if envDB := os.Getenv("DB_URL"); envDB != "" {
			*dbURL = envDB
		} else {
			// 2) Fall back to Turso-specific env vars
			tursoURL := os.Getenv("TURSO_URL")
			tursoToken := os.Getenv("TURSO_TOKEN")

			if tursoURL != "" {
				// Append authToken if not already present
				if tursoToken != "" && !strings.Contains(tursoURL, "authToken=") {
					sep := "?"
					if strings.Contains(tursoURL, "?") {
						sep = "&"
					}
					tursoURL = fmt.Sprintf("%s%sauthToken=%s", tursoURL, sep, tursoToken)
				}
				*dbURL = tursoURL
			}
		}
	}

	if *dbURL == "" {
		log.Fatal("Database URL is required. Provide -db flag, DB_URL, or TURSO_URL[/TURSO_TOKEN].")
	}

	// Validate that we're using Turso
	if !strings.HasPrefix(*dbURL, "libsql://") {
		log.Fatalf("ERROR: Database URL must be a Turso URL starting with libsql://\nGot: %s", *dbURL)
	}
	log.Printf("✓ Using Turso remote database")

	// Initialize database
	log.Printf("Connecting to database: %s", maskAuthToken(*dbURL))
	db, err := database.NewDB(*dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()
	log.Println("✓ Database connected successfully")

	// Initialize services
	userService := services.NewUserService(db)
	groupService := services.NewGroupService(db)
	channelService := services.NewChannelService(db)
	keyExchangeService := services.NewKeyExchangeService(db)
	webrtcService := services.NewWebRTCService(db)
	preKeyService := services.NewPreKeyService(db)
	senderKeyService := services.NewSenderKeyService(db)
	keyBackupService := services.NewKeyBackupService(db)

	// Start cleanup routines for expired messages
	keyExchangeService.StartCleanupRoutine(1 * time.Hour)
	webrtcService.StartCleanupRoutine(1 * time.Hour)

	// Create gRPC server
	grpcServer := grpc.NewServer()

	// Register handlers
	pollisHandler := handlers.NewPollisHandler(
		userService,
		groupService,
		channelService,
		keyExchangeService,
		webrtcService,
		preKeyService,
		senderKeyService,
		keyBackupService,
	)
	proto.RegisterPollisServiceServer(grpcServer, pollisHandler)

	// Enable reflection for development/testing
	if *enableReflection {
		reflection.Register(grpcServer)
		log.Println("gRPC reflection enabled")
	}

	// Start gRPC server
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		log.Fatalf("Failed to listen on port %d: %v", *port, err)
	}

	log.Printf("Starting gRPC server on port %d", *port)

	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Failed to serve gRPC: %v", err)
		}
	}()

	// Create gRPC-web wrapper for web clients
	wrappedGrpc := grpcweb.WrapServer(grpcServer,
		grpcweb.WithOriginFunc(func(origin string) bool {
			// Allow all origins in development
			// In production, restrict to your domains
			return true
		}),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
			return true
		}),
	)

	// Create HTTP handler with CORS support
	var httpHandler http.Handler = wrappedGrpc
	if *enableCORS {
		corsHandler := cors.New(cors.Options{
			AllowedOrigins:   []string{"*"}, // Configure for production
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"*"},
			ExposedHeaders:   []string{"Grpc-Status", "Grpc-Message", "Grpc-Encoding", "Grpc-Accept-Encoding"},
			AllowCredentials: true,
		})
		httpHandler = corsHandler.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if wrappedGrpc.IsGrpcWebRequest(r) || wrappedGrpc.IsAcceptableGrpcCorsRequest(r) {
				wrappedGrpc.ServeHTTP(w, r)
				return
			}
			// Health check endpoint
			if r.URL.Path == "/health" {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK"))
				return
			}
			http.NotFound(w, r)
		}))
	}

	// Start HTTP server for gRPC-web
	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", *httpPort),
		Handler: httpHandler,
	}

	log.Printf("Starting gRPC-web HTTP server on port %d", *httpPort)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to serve HTTP: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down servers...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown HTTP server
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("HTTP server shutdown error: %v", err)
	}

	// Shutdown gRPC server
	stopped := make(chan struct{})
	go func() {
		grpcServer.GracefulStop()
		close(stopped)
	}()

	select {
	case <-stopped:
		log.Println("Servers stopped gracefully")
	case <-ctx.Done():
		log.Println("Shutdown timeout exceeded, forcing stop")
		grpcServer.Stop()
	}
}

// maskAuthToken masks the auth token in the database URL for logging
func maskAuthToken(dbURL string) string {
	if strings.Contains(dbURL, "authToken=") {
		parts := strings.Split(dbURL, "authToken=")
		if len(parts) == 2 {
			token := parts[1]
			if len(token) > 8 {
				masked := token[:4] + "..." + token[len(token)-4:]
				return parts[0] + "authToken=" + masked
			}
			return parts[0] + "authToken=***"
		}
	}
	return dbURL
}
