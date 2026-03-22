const os = require("os");
const config = require("./config.js");

// ── HTTP request counters ──
const httpMethodCounts = { GET: 0, POST: 0, PUT: 0, DELETE: 0 };
let totalRequests = 0;

// ── Request latency tracking ──
let totalRequestLatencyMs = 0;
let requestLatencyCount = 0;

// ── Active users (unique user IDs seen recently) ──
const activeUsers = new Set();

// ── Auth counters ──
let authSuccessCount = 0;
let authFailCount = 0;

// ── Purchase counters ──
let pizzasSold = 0;
let pizzasFailed = 0;
let totalRevenue = 0;
let totalPizzaLatencyMs = 0;
let pizzaLatencyCount = 0;

// ── Middleware: track HTTP method + response latency ──
function requestTracker(req, res, next) {
  const method = req.method.toUpperCase();
  if (method in httpMethodCounts) {
    httpMethodCounts[method]++;
  }
  totalRequests++;

  // Track active user if authenticated
  if (req.user) {
    activeUsers.add(req.user.id);
  }

  // Measure response latency
  const start = Date.now();
  res.on("finish", () => {
    const latency = Date.now() - start;
    totalRequestLatencyMs += latency;
    requestLatencyCount++;
  });

  next();
}

// ── Auth tracking ──
function authAttempt(success) {
  if (success) {
    authSuccessCount++;
  } else {
    authFailCount++;
  }
}

// ── Purchase tracking ──
function pizzaPurchase(success, latencyMs, price) {
  if (success) {
    pizzasSold++;
    totalRevenue += price;
  } else {
    pizzasFailed++;
  }
  totalPizzaLatencyMs += latencyMs;
  pizzaLatencyCount++;
}

// ── Periodic push to Grafana ──
if (config.metrics) {
  setInterval(() => {
    const metrics = [
      // HTTP request metrics
      createMetric(
        "http_requests_total",
        totalRequests,
        "1",
        "sum",
        "asInt",
        {},
      ),
      createMetric(
        "http_requests_get",
        httpMethodCounts.GET,
        "1",
        "sum",
        "asInt",
        { method: "GET" },
      ),
      createMetric(
        "http_requests_post",
        httpMethodCounts.POST,
        "1",
        "sum",
        "asInt",
        { method: "POST" },
      ),
      createMetric(
        "http_requests_put",
        httpMethodCounts.PUT,
        "1",
        "sum",
        "asInt",
        { method: "PUT" },
      ),
      createMetric(
        "http_requests_delete",
        httpMethodCounts.DELETE,
        "1",
        "sum",
        "asInt",
        { method: "DELETE" },
      ),

      // Request latency (rolling average)
      createMetric(
        "request_latency",
        requestLatencyCount > 0
          ? totalRequestLatencyMs / requestLatencyCount
          : 0,
        "ms",
        "gauge",
        "asDouble",
        {},
      ),

      // Active users (unique user IDs in the current window)
      createMetric("active_users", activeUsers.size, "1", "gauge", "asInt", {}),

      // Auth metrics
      createMetric("auth_success", authSuccessCount, "1", "sum", "asInt", {}),
      createMetric("auth_failure", authFailCount, "1", "sum", "asInt", {}),

      // System metrics
      createMetric(
        "cpu_usage_percent",
        getCpuUsagePercentage(),
        "%",
        "gauge",
        "asDouble",
        {},
      ),
      createMetric(
        "memory_usage_percent",
        getMemoryUsagePercentage(),
        "%",
        "gauge",
        "asDouble",
        {},
      ),

      // Purchase metrics
      createMetric("pizzas_sold", pizzasSold, "1", "sum", "asInt", {}),
      createMetric("pizzas_failed", pizzasFailed, "1", "sum", "asInt", {}),
      createMetric("pizza_revenue", totalRevenue, "BTC", "sum", "asDouble", {}),
      createMetric(
        "pizza_creation_latency",
        pizzaLatencyCount > 0 ? totalPizzaLatencyMs / pizzaLatencyCount : 0,
        "ms",
        "gauge",
        "asDouble",
        {},
      ),
    ];

    sendMetricToGrafana(metrics);
  }, 10000).unref();
}

// ── Metric builder ──
function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes,
) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

// ── Grafana push ──
function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(config.metrics.endpointUrl, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

// ── System helpers ──
function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

module.exports = { requestTracker, pizzaPurchase, authAttempt };
