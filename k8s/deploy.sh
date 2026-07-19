#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="trippy-planner"

echo "Deploying to context: $(kubectl config current-context)"

kubectl apply -k "$SCRIPT_DIR/overlays/prod"

kubectl rollout restart deployment/trippy-planner deployment/trippy-backend -n "$NAMESPACE"

kubectl rollout status deployment/trippy-planner -n "$NAMESPACE"
kubectl rollout status deployment/trippy-backend -n "$NAMESPACE"
