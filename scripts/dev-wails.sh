#!/usr/bin/env bash

# Add Go bin to PATH
export PATH="$HOME/go/bin:$PATH"

# Disable async preemption to avoid signal conflicts with WebKit
# See: https://github.com/wailsapp/wails/issues/1733
export GODEBUG=asyncpreemptoff=1

# Disable WebKit compositing to reduce signal conflicts
export WEBKIT_DISABLE_COMPOSITING_MODE=1

# Show full stack traces on crash
export GOTRACEBACK=all

exec wails dev
