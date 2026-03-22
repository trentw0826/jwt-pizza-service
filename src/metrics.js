const os = require("os");
const config = require("./config.js");

// In-memory request counters
const httpMethodCounts = {
  GET: 0,
  POST: 0,
  PUT: 0,
  DELETE: 0,
};
let totalRequests = 0;

// Middleware to track HTTP requests by method
function requestTracker(req, res, next) {
  const method = req.method.toUpperCase();
  console.log(`[metrics] tracked ${method} ${req.path}`);
  if (method in httpMethodCounts) {
    httpMethodCounts[method]++;
  }
  totalRequests++;
  next();
}

// Periodically push metrics to Grafana
if (config.metrics) {
  setInterval(() => {
    const metrics = [
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
    ];

    sendMetricToGrafana(metrics);
  }, 10000).unref();
}

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

  console.log(
    "Pushing metrics:",
    JSON.stringify({ totalRequests, ...httpMethodCounts }),
  );

  fetch(config.metrics.endpointUrl, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      console.log("Grafana push status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

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

module.exports = { requestTracker };
