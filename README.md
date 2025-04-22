# Playerok Admin Panel Rewrite

This project is a rewrite of a media player mini PC admin panel. It's built using modern web technologies including React and Vite.
The dasboard controls a player binary that reads its config files. It is able to send and receive MQTT messages and the dashboard
helps users set up different ways in which they can make the player react to input messages or output messages when a certain state reached.

The specs are in AIDocs/.

## Tech Stack
- React
- Vite
- Modern CSS

## Development
To run the development server:
```bash
npm install
npm run dev
```

## Debugging in VS Code
This project includes VS Code launch configurations for debugging. You can debug the application in several ways:

1. **Debug in Chrome**: 
   - Start the development server (`npm run dev`)
   - Press F5 or select "Launch Chrome against localhost" from the debug menu
   - VS Code will launch Chrome and attach the debugger

2. **Debug Vite Dev Server**:
   - Select "Debug Vite Dev Server" from the debug menu
   - This will start the Vite dev server with debugging enabled

3. **Full Stack Debug**:
   - Select "Debug Full Stack" from the debug menu
   - This will launch both the Vite dev server and Chrome with debugging enabled

You can set breakpoints directly in VS Code, inspect variables, and use the debug console while debugging. The source maps are properly configured for accurate debugging of the React components. 

## MQTT Broker Setup

This project uses MQTT for real-time messaging. Install and run Mosquitto as follows:

### Install Mosquitto

- macOS (Homebrew):
  ```bash
  brew install mosquitto
  ```
- Ubuntu/Debian:
  ```bash
  sudo apt-get update
  sudo apt-get install -y mosquitto
  ```
- Docker:
  ```bash
  docker run -it -p 1883:1883 eclipse-mosquitto
  ```

### Run Mosquitto

Start the broker with default settings (port 1883):

```bash
mosquitto
```

Verify it's running by connecting with an MQTT client to `mqtt://localhost:1883`. 

## Backend MQTT Integration

- The `mqtt_worker.js` module in `backend/src` connects to the broker, subscribes to topics, stores up to 10,000 messages, tracks unique topics, and emits events via WebSockets.
- API endpoints:
  - GET `/api/mqtt/messages`: returns stored messages.
  - GET `/api/mqtt/topics`: returns unique topics.
  - POST `/api/mqtt/publish`: publishes a message with `{ topic, payload }`.

## Frontend MQTT Test Pages

- `/mqtt-log`: React page at `frontend/src/pages/MqttLogViewerPage.jsx` to view MQTT messages in real-time via WebSocket and HTTP fallback.
- `/mqtt-test`: React page at `frontend/src/pages/MqttTestSenderPage.jsx` for manual and slider-based message publishing (50ms throttle via `lodash-es`). 