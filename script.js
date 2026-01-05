// Security utilities
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeNumber(value) {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return 0;
    return num;
}

function validateUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const trimmed = url.trim();
    if (!trimmed) return false;
    
    const dangerousSchemes = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
    const lowerUrl = trimmed.toLowerCase();
    for (const scheme of dangerousSchemes) {
        if (lowerUrl.startsWith(scheme)) {
            return false;
        }
    }
    
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
        return false;
    }
    
    try {
        const urlObj = new URL(trimmed);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

let API_URL = localStorage.getItem('xmrig_api_url') || '';
let refreshInterval;
const DEBUG_MODE = false;
const MAX_HISTORY_POINTS = 2000;
const HISTORY_STORAGE_KEY = 'xmrig_dashboard_history';
const REFRESH_RATE_KEY = 'xmrig_refresh_rate';

// Chart instances
let mainChart = null;

// Time range for charts (in milliseconds)
let chartTimeRange = null;

// Chart visibility settings
let chartVisibility = {
    hashrate: true,
    miners: true
};

// Current refresh rate (milliseconds)
let refreshRate = parseInt(localStorage.getItem(REFRESH_RATE_KEY) || '10000', 10);

// Historical data management
function getHistory() {
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (!stored) return [];
        const history = JSON.parse(stored);
        return Array.isArray(history) ? history : [];
    } catch (e) {
        return [];
    }
}

function saveHistory(history) {
    try {
        const trimmed = history.slice(-MAX_HISTORY_POINTS);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (e) {
        safeLog('Failed to save history:', e);
    }
}

function addToHistory(data) {
    const history = getHistory();
    const timestamp = Date.now();
    
    const hashrates = Array.isArray(data.hashrate?.total) ? data.hashrate.total : [];
    const accepted = sanitizeNumber(data.results?.accepted || 0);
    const rejected = sanitizeNumber(data.results?.rejected || 0);
    const total = accepted + rejected;
    const acceptanceRate = total > 0 ? (accepted / total * 100) : 0;
    
    history.push({
        timestamp,
        hashrate: hashrates[0] || 0,
        miners: sanitizeNumber(data.miners?.now || 0),
        workers: sanitizeNumber(data.workers || 0),
        acceptanceRate,
        accepted,
        rejected,
        memoryUsed: sanitizeNumber(data.resources?.memory?.total || 0) - sanitizeNumber(data.resources?.memory?.free || 0),
        memoryTotal: sanitizeNumber(data.resources?.memory?.total || 0),
        upstreamsActive: sanitizeNumber(data.upstreams?.active || 0),
        latency: sanitizeNumber(data.results?.latency || 0),
        connections: sanitizeNumber(data.connection?.total || 0),
        algo: data.algo || 'Unknown',
        kind: data.kind || 'Unknown'
    });
    
    saveHistory(history);
    return history;
}

function safeLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

function destroyCharts() {
    if (mainChart) {
        mainChart.destroy();
        mainChart = null;
    }
}

function setRefreshRate(rateMs) {
    refreshRate = rateMs;
    localStorage.setItem(REFRESH_RATE_KEY, rateMs.toString());
    
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(fetchData, refreshRate);
    
    // Update button states
    const buttons = document.querySelectorAll('.refresh-btn');
    buttons.forEach(btn => {
        btn.classList.remove('refresh-btn-active');
        if (parseInt(btn.dataset.rate) === rateMs) {
            btn.classList.add('refresh-btn-active');
        }
    });
}

function showConfig() {
    destroyCharts();
    const currentUrl = localStorage.getItem('xmrig_api_url') || '';
    const dashboardEl = document.getElementById('dashboard');
    
    const configPanel = document.createElement('div');
    configPanel.className = 'config-panel';
    
    const title = document.createElement('div');
    title.className = 'config-title';
    title.innerHTML = '<i class="fas fa-cog"></i> Configure API Endpoint';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const label = document.createElement('label');
    label.className = 'input-label';
    label.textContent = 'XMRig Proxy API URL';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-field';
    input.id = 'apiUrlInput';
    input.value = currentUrl;
    input.placeholder = 'http://127.0.0.1:8080/1/summary';
    
    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    
    const buttonContainer = document.createElement('div');
    
    const saveButton = document.createElement('button');
    saveButton.className = 'btn';
    saveButton.innerHTML = '<i class="fas fa-save"></i> Save & Connect';
    saveButton.onclick = saveConfig;
    
    buttonContainer.appendChild(saveButton);
    
    if (currentUrl) {
        const cancelButton = document.createElement('button');
        cancelButton.className = 'btn btn-secondary';
        cancelButton.innerHTML = '<i class="fas fa-times"></i> Cancel';
        cancelButton.onclick = cancelConfig;
        buttonContainer.appendChild(cancelButton);
    }
    
    configPanel.appendChild(title);
    configPanel.appendChild(inputGroup);
    configPanel.appendChild(buttonContainer);
    
    dashboardEl.innerHTML = '';
    dashboardEl.appendChild(configPanel);
}

function saveConfig() {
    const input = document.getElementById('apiUrlInput');
    if (!input) return;
    
    const url = input.value.trim();
    if (!url) {
        alert('Please enter a valid API URL');
        return;
    }
    
    if (!validateUrl(url)) {
        alert('Invalid URL. Please enter a valid http:// or https:// URL.');
        return;
    }
    
    localStorage.setItem('xmrig_api_url', url);
    API_URL = url;
    
    const dashboardEl = document.getElementById('dashboard');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    const p = document.createElement('p');
    p.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    loadingDiv.appendChild(p);
    dashboardEl.innerHTML = '';
    dashboardEl.appendChild(loadingDiv);
    
    fetchData();
}

function cancelConfig() {
    const dashboardEl = document.getElementById('dashboard');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    const p = document.createElement('p');
    p.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading dashboard data...';
    loadingDiv.appendChild(p);
    dashboardEl.innerHTML = '';
    dashboardEl.appendChild(loadingDiv);
    fetchData();
}

function formatHashrate(value) {
    const num = sanitizeNumber(value);
    if (num === 0) return '0 H/s';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + ' GH/s';
    if (num >= 1000) return (num / 1000).toFixed(2) + ' MH/s';
    return num.toFixed(2) + ' KH/s';
}

function formatBytes(bytes) {
    const num = sanitizeNumber(bytes);
    if (num >= 1073741824) return (num / 1073741824).toFixed(2) + ' GB';
    if (num >= 1048576) return (num / 1048576).toFixed(2) + ' MB';
    if (num >= 1024) return (num / 1024).toFixed(2) + ' KB';
    return Math.round(num) + ' B';
}

function formatUptime(seconds) {
    const sec = sanitizeNumber(seconds);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
}

function formatNumber(num) {
    const n = sanitizeNumber(num);
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getStatusClass(data) {
    if (!data || !data.miners) return 'status-offline';
    const now = sanitizeNumber(data.miners.now);
    const max = sanitizeNumber(data.miners.max);
    if (now === 0) return 'status-offline';
    if (now < max * 0.5) return 'status-warning';
    return 'status-online';
}

function getStatusText(data) {
    if (!data || !data.miners) return 'Offline';
    const now = sanitizeNumber(data.miners.now);
    if (now === 0) return 'Offline';
    const max = sanitizeNumber(data.miners.max);
    if (now < max * 0.5) return 'Warning';
    return 'Online';
}

function sanitizeData(data) {
    if (!data || typeof data !== 'object') return null;
    
    const sanitized = {};
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            if (typeof value === 'number') {
                sanitized[key] = sanitizeNumber(value);
            } else if (typeof value === 'string') {
                sanitized[key] = value;
            } else if (Array.isArray(value)) {
                sanitized[key] = value.map(v => typeof v === 'number' ? sanitizeNumber(v) : v);
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

function createChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    return new Chart(ctx, config);
}

function filterHistoryByTimeRange(history, timeRangeMs) {
    if (!history || history.length === 0) return history;
    if (timeRangeMs === null) return history; // Lifetime - show all data
    const now = Date.now();
    const cutoff = now - timeRangeMs;
    return history.filter(h => h.timestamp >= cutoff);
}

function setChartTimeRange(chartName, timeRangeMs) {
    chartTimeRange = timeRangeMs;

    const buttons = document.querySelectorAll('.time-controls .chart-btn');
    buttons.forEach(btn => {
        btn.classList.remove('chart-btn-active');
        const btnText = btn.textContent.trim();
        if ((timeRangeMs === 60000 && btnText === '1 Min') ||
            (timeRangeMs === 300000 && btnText === '5 Min') ||
            (timeRangeMs === 3600000 && btnText === '1 Hour') ||
            (timeRangeMs === 86400000 && btnText === '1 Day') ||
            (timeRangeMs === null && btnText === 'Lifetime')) {
            btn.classList.add('chart-btn-active');
        }
    });

    // Destroy and recreate chart for clean time range switching
    destroyCharts();
    const history = getHistory();
    updateMainChart(history);
}


function updateChartData(chart, labels, data) {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
}

function updateMainChart(history) {
    if (!history || history.length === 0) return;

    const filteredHistory = filterHistoryByTimeRange(history, chartTimeRange);
    if (filteredHistory.length === 0) return;

    const labels = filteredHistory.map(h => h.timestamp);

    // Prepare datasets - just hashrate and active miners
    const datasets = [
        {
            label: 'Hashrate (KH/s)',
            data: filteredHistory.map(h => sanitizeNumber(h.hashrate)),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0,
            fill: false,
            pointRadius: 0,
            yAxisID: 'y'
        },
        {
            label: 'Active Miners',
            data: filteredHistory.map(h => sanitizeNumber(h.miners)),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0,
            fill: false,
            pointRadius: 0,
            yAxisID: 'y1'
        }
    ];


    if (mainChart) {
        mainChart.data.labels = labels;
        mainChart.data.datasets = datasets;
        mainChart.update('none');
    } else {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
                animation: {
                    duration: 200, // Short animation for smooth legend clicks
                    onComplete: function() {
                        // Update our visibility settings based on current chart state
                        if (mainChart) {
                            mainChart.data.datasets.forEach((dataset, index) => {
                                const meta = mainChart.getDatasetMeta(index);
                                const isVisible = !meta.hidden;

                                if (dataset.label.includes('Hashrate')) {
                                    chartVisibility.hashrate = isVisible;
                                } else if (dataset.label.includes('Active Miners')) {
                                    chartVisibility.miners = isVisible;
                                }
                            });

                            // Update Y-axis visibility
                            const yAxes = mainChart.options.scales;
                            if (yAxes.y) yAxes.y.display = chartVisibility.hashrate;
                            if (yAxes.y1) yAxes.y1.display = chartVisibility.miners;
                        }
                    }
                },
            plugins: {
                legend: {
                    labels: { color: '#e0e0e0' },
                    onClick: function(e, legendItem, legend) {
                        // Let Chart.js handle the default legend click behavior
                        // We'll update our settings and Y-axes in the animation complete callback
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            if (context.parsed.y === null) return 'No data';
                            let unit = '';
                            if (context.dataset.label.includes('Hashrate')) unit = ' KH/s';
                            else if (context.dataset.label.includes('Memory')) unit = '%';
                            else unit = '';
                            return context.dataset.label + ': ' + (context.dataset.label.includes('Hashrate') ? context.parsed.y.toFixed(2) : Math.round(context.parsed.y)) + unit;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'MMM dd'
                        }
                    },
                    ticks: { color: '#888' },
                    grid: { color: '#333' }
                },
                y: {
                    type: 'linear',
                    display: chartVisibility.hashrate,
                    position: 'left',
                    ticks: { color: '#10b981' },
                    grid: { color: '#333' },
                    title: {
                        display: true,
                        text: 'Hashrate (KH/s)',
                        color: '#10b981'
                    }
                },
                y1: {
                    type: 'linear',
                    display: chartVisibility.miners,
                    position: 'right',
                    ticks: { color: '#3b82f6' },
                    grid: { drawOnChartArea: false },
                    title: {
                        display: true,
                        text: 'Miners',
                        color: '#3b82f6'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };

        mainChart = createChart('mainChart', {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: chartOptions
        });

        // Apply initial hidden state to Chart.js internal state
        datasets.forEach((dataset, index) => {
            if (dataset.hidden) {
                const meta = mainChart.getDatasetMeta(index);
                meta.hidden = true;
            }
        });
        mainChart.update('none');
    }
}

function updateValueSmoothly(element, newValue, formatter = null) {
    if (!element) return;
    const currentText = element.textContent || element.innerText;
    const currentValue = parseFloat(currentText.replace(/[^\d.]/g, '')) || 0;
    const targetValue = typeof newValue === 'number' ? newValue : parseFloat(String(newValue).replace(/[^\d.]/g, '')) || 0;
    
    if (Math.abs(currentValue - targetValue) < 0.01) {
        element.textContent = formatter ? formatter(targetValue) : String(newValue);
        return;
    }
    
    const step = (targetValue - currentValue) / 10;
    let current = currentValue;
    const interval = setInterval(() => {
        current += step;
        if ((step > 0 && current >= targetValue) || (step < 0 && current <= targetValue)) {
            current = targetValue;
            clearInterval(interval);
        }
        element.textContent = formatter ? formatter(current) : current.toFixed(2);
    }, 16);
}

function updateDashboardValues(data) {
    const safeData = sanitizeData(data);
    if (!safeData) return;
    
    const hashrates = Array.isArray(safeData.hashrate?.total) ? safeData.hashrate.total : [];
    const memoryTotal = sanitizeNumber(safeData.resources?.memory?.total || 0);
    const memoryFree = sanitizeNumber(safeData.resources?.memory?.free || 0);
    const memoryUsed = Math.max(0, memoryTotal - memoryFree);
    const memoryUsedPercent = memoryTotal > 0 ? Math.max(0, Math.min(100, (memoryUsed / memoryTotal * 100))) : 0;
    
    const accepted = sanitizeNumber(safeData.results?.accepted || 0);
    const rejected = sanitizeNumber(safeData.results?.rejected || 0);
    const invalid = sanitizeNumber(safeData.results?.invalid || 0);
    const expired = sanitizeNumber(safeData.results?.expired || 0);
    const total = accepted + rejected;
    const acceptanceRate = total > 0 ? (accepted / total * 100) : 0;
    
    const minersNow = sanitizeNumber(safeData.miners?.now || 0);
    const minersMax = sanitizeNumber(safeData.miners?.max || 0);
    const workers = sanitizeNumber(safeData.workers || 0);
    
    // Update stat cards
    const hashrateValue = document.querySelector('.stat-card:nth-child(1) .card-value');
    if (hashrateValue) hashrateValue.textContent = formatHashrate(hashrates[0]);
    
    const minersValue = document.querySelector('.stat-card:nth-child(2) .card-value');
    if (minersValue) minersValue.textContent = formatNumber(minersNow);
    
    const workersValue = document.querySelector('.stat-card:nth-child(3) .card-value');
    if (workersValue) workersValue.textContent = String(workers);
    
    const acceptanceValue = document.querySelector('.stat-card:nth-child(4) .card-value');
    if (acceptanceValue) acceptanceValue.textContent = acceptanceRate.toFixed(2) + '%';
    
    // Update progress bars
    const minersProgress = document.querySelector('.stat-card:nth-child(2) .progress-fill');
    if (minersProgress) {
        const width = Math.max(0, Math.min(100, (minersNow / Math.max(1, minersMax) * 100)));
        minersProgress.style.width = width + '%';
    }
    
    
    // Update Mining Results
    const acceptedEl = document.querySelector('#accepted');
    if (acceptedEl) acceptedEl.textContent = formatNumber(accepted);
    
    const rejectedEl = document.querySelector('#rejected');
    if (rejectedEl) rejectedEl.textContent = formatNumber(rejected);
    
    const invalidEl = document.querySelector('#invalid');
    if (invalidEl) invalidEl.textContent = formatNumber(invalid);
    
    const expiredEl = document.querySelector('#expired');
    if (expiredEl) expiredEl.textContent = formatNumber(expired);
    
    const acceptanceRateEl = document.querySelector('#acceptanceRate');
    if (acceptanceRateEl) acceptanceRateEl.textContent = acceptanceRate.toFixed(2) + '%';
    
    const latencyEl = document.querySelector('#latency');
    if (latencyEl) latencyEl.textContent = String(sanitizeNumber(safeData.results?.latency || 0)) + ' ms';
    
    const totalHashesEl = document.querySelector('#totalHashes');
    if (totalHashesEl) totalHashesEl.textContent = formatNumber(sanitizeNumber(safeData.results?.hashes_total || 0));
    
    const avgTimeEl = document.querySelector('#avgTime');
    if (avgTimeEl) avgTimeEl.textContent = String(sanitizeNumber(safeData.results?.avg_time || 0)) + ' sec';
    
    // Update hashrate metrics
    const hashrateMetrics = document.querySelectorAll('.metric-value');
    if (hashrateMetrics.length >= 6) {
        hashrateMetrics[0].textContent = formatHashrate(hashrates[0]);
        hashrateMetrics[1].textContent = formatHashrate(hashrates[1]);
        hashrateMetrics[2].textContent = formatHashrate(hashrates[2]);
        hashrateMetrics[3].textContent = formatHashrate(hashrates[3]);
        hashrateMetrics[4].textContent = formatHashrate(hashrates[4]);
        hashrateMetrics[5].textContent = formatHashrate(hashrates[5]);
    }

    // Update additional information
    const algorithmEl = document.querySelector('#algorithm');
    if (algorithmEl) algorithmEl.textContent = safeData.algo || 'Unknown';

    const proxyTypeEl = document.querySelector('#proxyType');
    if (proxyTypeEl) proxyTypeEl.textContent = safeData.kind || 'Unknown';

    const totalConnectionsEl = document.querySelector('#totalConnections');
    if (totalConnectionsEl) totalConnectionsEl.textContent = formatNumber(sanitizeNumber(safeData.connection?.total || 0));

    // Update pool statistics
    const activePoolsEl = document.querySelector('#activePools');
    if (activePoolsEl) activePoolsEl.textContent = String(safeData.upstreams?.active || 0);

    const sleepingPoolsEl = document.querySelector('#sleepingPools');
    if (sleepingPoolsEl) sleepingPoolsEl.textContent = String(safeData.upstreams?.sleep || 0);

    const errorPoolsEl = document.querySelector('#errorPools');
    if (errorPoolsEl) {
        errorPoolsEl.textContent = String(safeData.upstreams?.error || 0);
        errorPoolsEl.className = 'stat-value ' + (sanitizeNumber(safeData.upstreams?.error || 0) > 0 ? 'highlight-red' : '');
    }

    const totalPoolsEl = document.querySelector('#totalPools');
    if (totalPoolsEl) totalPoolsEl.textContent = String(safeData.upstreams?.total || 0);
}

let dashboardInitialized = false;

function renderDashboard(data) {
    const safeData = sanitizeData(data);
    if (!safeData) {
        showError('Invalid data received from API');
        return;
    }
    
    const history = addToHistory(safeData);
    
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.className = 'status-badge ' + getStatusClass(safeData);
        statusBadge.textContent = getStatusText(safeData);
    }

    const workerIdEl = document.getElementById('workerId');
    if (workerIdEl) {
        const workerId = escapeHtml(String(safeData.worker_id || 'Unknown'));
        const version = escapeHtml(String(safeData.version || 'Unknown'));
        workerIdEl.innerHTML = `<i class="fas fa-server"></i> Worker: ${workerId} | <i class="fas fa-tag"></i> Version: ${version}`;
    }
    
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }

    const hashrates = Array.isArray(safeData.hashrate?.total) ? safeData.hashrate.total : [];
    const memoryTotal = sanitizeNumber(safeData.resources?.memory?.total || 0);
    const memoryFree = sanitizeNumber(safeData.resources?.memory?.free || 0);
    const memoryUsed = Math.max(0, memoryTotal - memoryFree);
    const memoryUsedPercent = memoryTotal > 0 ? Math.max(0, Math.min(100, (memoryUsed / memoryTotal * 100))).toFixed(1) : '0.0';
    
    const accepted = sanitizeNumber(safeData.results?.accepted || 0);
    const rejected = sanitizeNumber(safeData.results?.rejected || 0);
    const invalid = sanitizeNumber(safeData.results?.invalid || 0);
    const expired = sanitizeNumber(safeData.results?.expired || 0);
    const total = accepted + rejected;
    const acceptanceRate = total > 0 ? (accepted / total * 100).toFixed(2) : '0.00';
    
    const minersNow = sanitizeNumber(safeData.miners?.now || 0);
    const minersMax = sanitizeNumber(safeData.miners?.max || 0);
    const workers = sanitizeNumber(safeData.workers || 0);
    const connections = sanitizeNumber(safeData.connection?.total || 0);
    const algo = safeData.algo || 'Unknown';
    const kind = safeData.kind || 'Unknown';

    if (dashboardInitialized) {
        updateDashboardValues(safeData);
        setTimeout(() => updateMainChart(history), 50);
        return;
    }
    
    const html = `
        <div class="grid stats-grid">
            <div class="card stat-card">
                <div class="card-title"><i class="fas fa-tachometer-alt"></i> Current Hashrate</div>
                <div class="card-value highlight-green">${escapeHtml(formatHashrate(hashrates[0]))}</div>
                <div class="card-label">10s average</div>
            </div>

            <div class="card stat-card">
                <div class="card-title"><i class="fas fa-users"></i> Active Miners</div>
                <div class="card-value ${minersNow > 0 ? 'highlight-green' : 'highlight-red'}">${escapeHtml(formatNumber(minersNow))}</div>
                <div class="card-label">Peak: ${escapeHtml(formatNumber(minersMax))} miners</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.max(0, Math.min(100, (minersNow / Math.max(1, minersMax) * 100)))}%"></div>
                </div>
            </div>

            <div class="card stat-card">
                <div class="card-title"><i class="fas fa-network-wired"></i> Workers Connected</div>
                <div class="card-value highlight-blue">${escapeHtml(String(workers))}</div>
                <div class="card-label">Ratio: ${escapeHtml(String((safeData.upstreams?.ratio || 0).toFixed(1)))} miners/upstream</div>
            </div>

            <div class="card stat-card">
                <div class="card-title"><i class="fas fa-check-circle"></i> Acceptance Rate</div>
                <div class="card-value highlight-blue">${escapeHtml(acceptanceRate)}%</div>
                <div class="card-label">${escapeHtml(formatNumber(accepted))} accepted, ${escapeHtml(formatNumber(rejected))} rejected</div>
            </div>
        </div>

        <div class="grid">
            <div class="card large-card">
                <div class="card-title"><i class="fas fa-chart-bar"></i> Hashrate Performance</div>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-value highlight-green">${escapeHtml(formatHashrate(hashrates[0]))}</div>
                        <div class="metric-label">10 Seconds</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${escapeHtml(formatHashrate(hashrates[1]))}</div>
                        <div class="metric-label">1 Minute</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${escapeHtml(formatHashrate(hashrates[2]))}</div>
                        <div class="metric-label">15 Minutes</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${escapeHtml(formatHashrate(hashrates[3]))}</div>
                        <div class="metric-label">1 Hour</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${escapeHtml(formatHashrate(hashrates[4]))}</div>
                        <div class="metric-label">12 Hours</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${escapeHtml(formatHashrate(hashrates[5]))}</div>
                        <div class="metric-label">24 Hours</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title"><i class="fas fa-award"></i> Mining Results</div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-check"></i> Accepted</span>
                    <span class="stat-value highlight-green" id="accepted">${escapeHtml(formatNumber(accepted))}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-times"></i> Rejected</span>
                    <span class="stat-value highlight-red" id="rejected">${escapeHtml(formatNumber(rejected))}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-ban"></i> Invalid</span>
                    <span class="stat-value highlight-yellow" id="invalid">${escapeHtml(formatNumber(invalid))}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-hourglass-end"></i> Expired</span>
                    <span class="stat-value" id="expired">${escapeHtml(formatNumber(expired))}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-percentage"></i> Acceptance Rate</span>
                    <span class="stat-value highlight-blue" id="acceptanceRate">${escapeHtml(acceptanceRate)}%</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-clock"></i> Latency</span>
                    <span class="stat-value" id="latency">${escapeHtml(String(sanitizeNumber(safeData.results?.latency || 0)))} ms</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-hashtag"></i> Total Hashes</span>
                    <span class="stat-value" id="totalHashes">${escapeHtml(formatNumber(sanitizeNumber(safeData.results?.hashes_total || 0)))}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fas fa-stopwatch"></i> Avg Submit Time</span>
                    <span class="stat-value" id="avgTime">${escapeHtml(String(sanitizeNumber(safeData.results?.avg_time || 0)))} sec</span>
                </div>
            </div>
        </div>


        <div class="grid">
            <div class="card chart-card large-chart-card">
                <div class="card-title"><i class="fas fa-chart-area"></i> Mining Analytics</div>
                <div class="chart-controls">
                <div class="time-controls">
                    <button class="chart-btn" onclick="setChartTimeRange('hashrate', 60000)">1 Min</button>
                    <button class="chart-btn" onclick="setChartTimeRange('hashrate', 300000)">5 Min</button>
                    <button class="chart-btn" onclick="setChartTimeRange('hashrate', 3600000)">1 Hour</button>
                    <button class="chart-btn" onclick="setChartTimeRange('hashrate', 86400000)">1 Day</button>
                    <button class="chart-btn chart-btn-active" onclick="setChartTimeRange('hashrate', null)">Lifetime</button>
                </div>
                    <div class="memory-display">
                        <i class="fas fa-memory"></i> RAM: <span id="ramUsage">${escapeHtml(formatBytes(memoryUsed))}/${escapeHtml(formatBytes(memoryTotal))} (${escapeHtml(memoryUsedPercent)}%)</span>
                    </div>
                </div>
                <div class="chart-container large-chart">
                    <canvas id="mainChart"></canvas>
                </div>
            </div>
        </div>
    `;

    const dashboardEl = document.getElementById('dashboard');
    if (dashboardEl) {
        dashboardEl.innerHTML = html;
        dashboardEl.className = '';
        dashboardInitialized = true;
        
        setTimeout(() => {
            updateMainChart(history);
        }, 100);
    }
}

function showError(message) {
    destroyCharts();
    dashboardInitialized = false;
    const dashboardEl = document.getElementById('dashboard');
    if (!dashboardEl) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    
    const strong = document.createElement('strong');
    strong.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error: ';
    
    const text = document.createTextNode(String(message || 'Unknown error'));
    
    errorDiv.appendChild(strong);
    errorDiv.appendChild(text);
    
    dashboardEl.innerHTML = '';
    dashboardEl.appendChild(errorDiv);
    
    const statusBadge = document.getElementById('statusBadge');
    if (statusBadge) {
        statusBadge.className = 'status-badge status-offline';
        statusBadge.textContent = 'Offline';
    }
}

async function fetchData() {
    if (!API_URL) {
        showConfig();
        return;
    }
    
    if (!validateUrl(API_URL)) {
        showError('Invalid API URL stored. Please reconfigure.');
        localStorage.removeItem('xmrig_api_url');
        API_URL = '';
        showConfig();
        return;
    }
    
    try {
        safeLog('Fetching data from API');
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Invalid response type. Expected JSON.');
        }
        
        const data = await response.json();
        safeLog('Data received successfully');
        
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid data format received from API');
        }
        
        renderDashboard(data);
    } catch (error) {
        safeLog('Fetch error:', error.message);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        showError(`Failed to fetch data: ${errorMessage}`);
    }
}

// Validate API_URL on load
if (API_URL && !validateUrl(API_URL)) {
    localStorage.removeItem('xmrig_api_url');
    API_URL = '';
}

// Set initial refresh rate button state
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        fetchData();
        refreshInterval = setInterval(fetchData, refreshRate);
        setTimeout(() => setRefreshRate(refreshRate), 100);
    });
} else {
    fetchData();
    refreshInterval = setInterval(fetchData, refreshRate);
    setTimeout(() => setRefreshRate(refreshRate), 100);
}
