# Fiestaflare Chat - Desktop App

Electron desktop application for Fiestaflare customer service chat.

## Features

- Standalone desktop chat application
- System tray support (minimize to tray)
- Auto-reload on new messages
- Windows, macOS, and Linux support

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

```bash
cd electron
npm install
```

## Run in Development

```bash
npm start
```

## Build for Distribution

### Build for Windows (.exe)
```bash
npm run build:win
```

### Build for macOS (.dmg)
```bash
npm run build:mac
```

### Build for Linux (.AppImage)
```bash
npm run build:linux
```

## Output

Built applications will be in the `dist` folder:
- Windows: `dist/Fiestaflare Chat Setup.exe`
- macOS: `dist/Fiestaflare Chat.dmg`
- Linux: `dist/Fiestaflare Chat.AppImage`

## Usage

1. Install and run the application
2. Login with admin credentials
3. Chat conversations will auto-refresh every 3 seconds
4. Minimize to system tray when closed
