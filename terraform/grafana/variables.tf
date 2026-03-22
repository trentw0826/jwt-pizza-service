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
