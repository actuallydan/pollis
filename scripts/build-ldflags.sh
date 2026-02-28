#!/usr/bin/env bash
# Generates Go ldflags that embed env vars into the binary at compile time.
# Usage: wails build -ldflags "$(./scripts/build-ldflags.sh)"
#
# Reads from the current environment — caller is responsible for sourcing
# the correct env file (.env.local for dev, .env.production for prod).

FLAGS=""

add_flag() {
  local var_name="$1"
  local go_var="$2"
  local val="${!var_name}"
  if [ -n "$val" ]; then
    FLAGS="$FLAGS -X main.$go_var=$val"
  fi
}

add_flag "VITE_SERVICE_URL"           "cfgServiceURL"
add_flag "CLERK_SECRET_KEY"           "cfgClerkSecret"
add_flag "VITE_CLERK_PUBLISHABLE_KEY" "cfgClerkPubKey"
add_flag "ABLY_API_KEY"               "cfgAblyKey"
add_flag "TURSO_URL"                  "cfgTursoURL"
add_flag "TURSO_TOKEN"                "cfgTursoToken"
add_flag "R2_ACCESS_KEY_ID"           "cfgR2AccessKey"
add_flag "R2_SECRET_KEY"              "cfgR2SecretKey"
add_flag "R2_S3_ENDPOINT"            "cfgR2Endpoint"
add_flag "R2_PUBLIC_URL"              "cfgR2PublicURL"

echo "$FLAGS"
