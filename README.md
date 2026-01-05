# XMRig Proxy Dashboard

A modern, real-time web dashboard for monitoring XMRig Proxy mining operations.

## Features

- **Real-time Monitoring** - Auto-refreshes every 10 seconds
- **Worker Statistics** - Track active miners, workers, and uptime
- **Hashrate Analytics** - View performance across multiple time periods (10s, 1m, 15m, 1h, 12h, 24h)
- **System Resources** - Monitor memory usage, CPU load, and hardware stats
- **Mining Results** - Track accepted/rejected shares, acceptance rate, and latency
- **Upstream Pools** - Monitor pool connections and status

## Quick Start

1. **Open the dashboard**
   ```bash
   # Serve the files with any web server, or run locally!
   python3 -m http.server 8000
   ```

2. **Access in browser**
   ```
   http://localhost:8000/index.html
   ```
   
   **OR**
   
   **2a. Open directly**
   - Simply double-click `index.html` to open it in your browser
   - No web server required!

3. **Configure API endpoint**
   - On first launch, enter your XMRig Proxy API URL
   - Example: `http://proxyip:8080/1/summary`
   - Click "Save & Connect"

## Files

- `index.html` - Main HTML structure
- `styles.css` - All styling and layout
- `script.js` - Dashboard logic and API integration

## Requirements

- Modern web browser
- XMRig Proxy with API enabled
- Access to XMRig Proxy `/1/summary` endpoint

## XMRig Proxy Configuration

To enable the HTTP API on your XMRig Proxy, add this to your `config.json`:

```json
"http": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 8080,
    "access-token": null,
    "restricted": true
}
```


## Status Indicators

- 🟢 **Green** - Online, healthy operation
- 🟡 **Yellow** - Warning (miners below 50% of peak)
- 🔴 **Red** - Offline or error state

## License

Open source - use freely
