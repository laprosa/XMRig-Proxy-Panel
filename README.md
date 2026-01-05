# XMRig Proxy Dashboard

A modern, real-time web dashboard for monitoring XMRig Proxy mining operations.

<p align="center">
  <img src="https://raw.githubusercontent.com/laprosa/XMRig-Proxy-Panel/refs/heads/main/panel.png" width=600px height=600px />
</p>


## Features

- **Real-time Monitoring** - Auto-refreshes with configurable intervals (1s, 5s, 10s, 30s)
- **Worker Statistics** - Track active miners and uptime
- **Hashrate Analytics** - View performance across multiple time periods (10s, 1m, 15m, 1h, 12h, 24h)
- **Interactive Charts** - Clean chart showing hashrate and active miners with time axis
- **Time Range Selection** - View data for 1 min, 5 min, 1 hour, 1 day, or lifetime
- **Extended History** - Up to 2000 data points for comprehensive lifetime view
- **Memory Monitoring** - Simple RAM usage display
- **Mining Results** - Track accepted/rejected shares, acceptance rate, and latency
- **Chart.js Legend Controls** - Click legend to show/hide hashrate or miners
- **Dual Y-Axes** - Hashrate on left axis, miners on right axis
- **Time Series Scaling** - Proper time axis handling for accurate data visualization
- **Clean Default View** - Optimized for essential mining metrics
- **Security Features** - Content Security Policy, input validation, and XSS protection

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
