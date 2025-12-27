module pollis-service

go 1.25

require (
	github.com/improbable-eng/grpc-web v0.15.0
	github.com/joho/godotenv v1.5.1
	github.com/oklog/ulid/v2 v2.1.1
	github.com/rs/cors v1.11.1
	github.com/tursodatabase/libsql-client-go v0.0.0-20251219100830-236aa1ff8acc
	google.golang.org/grpc v1.77.0
	pollis/pkg/proto v0.0.0
)

replace pollis/pkg/proto => ../pkg/proto

require (
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/cenkalti/backoff/v4 v4.1.1 // indirect
	github.com/coder/websocket v1.8.14 // indirect
	github.com/desertbit/timer v0.0.0-20180107155436-c41aec40b27f // indirect
	github.com/klauspost/compress v1.11.7 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/stretchr/testify v1.7.1 // indirect
	github.com/ugorji/go/codec v1.1.9 // indirect
	golang.org/x/exp v0.0.0-20251219203646-944ab1f22d93 // indirect
	golang.org/x/net v0.46.1-0.20251013234738-63d1a5100f82 // indirect
	golang.org/x/sys v0.37.0 // indirect
	golang.org/x/text v0.30.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20251022142026-3a174f9686a8 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
	nhooyr.io/websocket v1.8.7 // indirect
)
