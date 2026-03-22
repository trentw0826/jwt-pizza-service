# Grafana Dashboard Terraform

This folder contains a minimal Terraform project that manages Grafana dashboards for this service.

## What it manages

- `grafana_dashboard.jwt_pizza_service` from `dashboards/jwt-pizza-service-overview.json`

## Required GitHub secrets

- `GRAFANA_TERRAFORM_URL` (example: `https://your-stack.grafana.net`)
- `GRAFANA_TERRAFORM_AUTH` (Grafana service account token with dashboard write permissions)

## Optional GitHub secrets

- `GRAFANA_PROM_DS_UID` (defaults to `grafanacloud-prom`)
- `METRICS_SOURCE` (defaults to `jwt-pizza-service-dev`)

## Local usage

```bash
cd terraform/grafana
terraform init
terraform plan \
  -var="grafana_url=https://your-stack.grafana.net" \
  -var="grafana_auth=your-token"
terraform apply \
  -var="grafana_url=https://your-stack.grafana.net" \
  -var="grafana_auth=your-token"
```
