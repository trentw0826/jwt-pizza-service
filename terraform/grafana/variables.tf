variable "grafana_url" {
  description = "Grafana base URL (for example: https://example.grafana.net)"
  type        = string
  sensitive   = true
}

variable "grafana_auth" {
  description = "Grafana service account token with dashboard write permissions"
  type        = string
  sensitive   = true
}

variable "prometheus_datasource_uid" {
  description = "Grafana Prometheus datasource UID used by dashboard panels"
  type        = string
  default     = "grafanacloud-prom"
}

variable "metrics_source" {
  description = "Value of the 'source' metric label emitted by the service"
  type        = string
  default     = "jwt-pizza-service-dev"
}
