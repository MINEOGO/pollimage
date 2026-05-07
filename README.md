# pollimage

Pollimage CLI by mineogo - Generate images with Pollinations AI.

## Installation

```bash
npm install -g pollimage
```

## Usage

### Interactive Mode
Run the interactive CLI:
```bash
pollimage
```
Inside, use the status bar to monitor your session and commands like `/set model` to pick your AI.

### Direct Generation
```bash
pollimage gen "a cyberpunk city" --model flux --width 1024 --height 1024
```

### Configuration
```bash
pollimage set-key <your-api-key>
pollimage set-key 0 # removes the key
```

## Features
- Dynamic status bar (API key status, active model, pollen balance).
- Searchable model selector via `/set model`.
- Auto-fetches live models from Pollinations AI.
- Saves images to `pollimage/images/` and displays in terminal via `viu`.
- Comment-free codebase.
