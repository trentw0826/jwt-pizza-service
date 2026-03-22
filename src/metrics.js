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

module.exports = { requestTracker };
