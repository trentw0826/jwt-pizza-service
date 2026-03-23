const os = require("os");
const config = require("./config.js");

const exporterStartTimeUnixNano = Date.now() * 1000000;

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

  // Measure response latency and track active user after response
  const start = Date.now();
  res.on("finish", () => {
    const latency = Date.now() - start;
    totalRequestLatencyMs += latency;
    requestLatencyCount++;

    // Track active user (req.user is set by setAuthUser middleware by now)
    if (req.user) {
      activeUsers.add(req.user.id);
    }
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
  attributes = {
    ...attributes,
    source: config.metrics.source,
  };

  const normalizedValue = normalizeMetricValue(metricValue, valueType);
  if (normalizedValue === null) {
    return null;
  }

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: normalizedValue,
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
    metric[metricType].dataPoints[0].startTimeUnixNano =
      exporterStartTimeUnixNano;
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function normalizeMetricValue(metricValue, valueType) {
  const numericValue = Number(metricValue);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (valueType === "asInt") {
    return Math.trunc(numericValue);
  }

  return numericValue;
}

// ── Grafana push ──
function sendMetricToGrafana(metrics) {
  const validMetrics = metrics.filter(Boolean);

  if (validMetrics.length === 0) {
    return;
  }

  const body = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: {
                stringValue: config.metrics.source,
              },
            },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: "jwt-pizza-service.metrics",
            },
            metrics: validMetrics,
          },
        ],
      },
    ],
  };

  // Debug: compact summary of all metric values
  // const summary = validMetrics.map((m) => {
  //   const type = m.sum ? "sum" : "gauge";
  //   const dp = m[type].dataPoints[0];
  //   const val = dp.asInt ?? dp.asDouble ?? 0;
  //   return `${m.name}=${val}`;
  // });
  // console.log("[metrics push]", summary.join(", "));

  fetch(config.metrics.endpointUrl, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then(async (response) => {
      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status} body=${responseBody}`);
      }

      if (!responseBody) {
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(responseBody);
      } catch {
        return;
      }

      const partial = parsed.partialSuccess;
      if (partial) {
        console.warn(
          "[metrics partial success]",
          JSON.stringify({
            rejectedDataPoints: partial.rejectedDataPoints,
            errorMessage: partial.errorMessage,
          }),
        );
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
  return Number(memoryUsage.toFixed(2));
}

module.exports = { requestTracker, pizzaPurchase, authAttempt };
