#!/usr/bin/env bash
# Wrapper: run /tmp/wikey-cdp.py with the isolated venv that has websocket-client.
exec /Users/denny/Project/wikey/.venv-smoke/bin/python /tmp/wikey-cdp.py "$@"
