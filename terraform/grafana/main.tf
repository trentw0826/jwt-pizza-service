provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_auth
}

locals {
  dashboard_config_json = replace(
    replace(
      file("${path.module}/dashboards/jwt-pizza-service-overview.json"),
      "\"uid\": \"grafanacloud-prom\"",
      "\"uid\": \"${var.prometheus_datasource_uid}\"",
    ),
    "\"current\": { \"text\": \"jwt-pizza-service-dev\", \"value\": \"jwt-pizza-service-dev\" }",
    "\"current\": { \"text\": \"${var.metrics_source}\", \"value\": \"${var.metrics_source}\" }",
  )
}

resource "grafana_dashboard" "jwt_pizza_service" {
  config_json = local.dashboard_config_json
  overwrite   = true
  message     = "Updated by GitHub Actions Terraform"
}
