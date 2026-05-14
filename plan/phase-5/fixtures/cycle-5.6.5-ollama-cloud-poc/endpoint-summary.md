ollama local URL = http://localhost:11434 (cloud routing via signed-in CLI)
auth = SSH key (~/.ollama/id_ed25519) + ollama signin (browser OAuth flow → ollama.com/connect)
transport variant = (a) local CLI URL switch — provider key 'ollama-cloud' + OLLAMA_URL still 127.0.0.1:11434 + model identifier with :cloud suffix dispatches to cloud
