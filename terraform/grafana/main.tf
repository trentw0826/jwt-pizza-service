provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_auth
}

resource "grafana_dashboard" "jwt_pizza_service" {
  config_json = file("${path.module}/dashboards/jwt-pizza-service-overview.json")
  overwrite   = true
  message     = "Updated by GitHub Actions Terraform"
}
