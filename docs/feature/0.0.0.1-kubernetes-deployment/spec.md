# Kubernetes Deployment

- Version: `0.0.0.1`
- Type: `feature`
- Slug: `kubernetes-deployment`
- Branch: `feature/kubernetes-deployment`
- Status: In progress

## Context

The Music Catalog web application is a static Vite/React single-page application
stored in IndexedDB. The base feature (`0.0.0.0-base`) is feature-complete and
verified locally. The application needs to be reachable by users through the
organization's Kubernetes infrastructure.

The target infrastructure is a minikube cluster (`etops`) running inside a Docker
container on `ci.egypteam.com`:

- Single control-plane node `etops`, Kubernetes `v1.32.0`.
- Node uses `cri-dockerd`; the node's Docker daemon is the image store. Images for
  deployments are loaded directly into the node (e.g.
  `galaxy-agent-network:deploy-<timestamp>` with `imagePullPolicy: IfNotPresent`)
  because private GHCR pulls from nodes are unauthorized.
- `ingress-nginx` controller is present but the established pattern is for the host
  Apache2 (which terminates TLS for `*.egypteam.com`) to proxy to a NodePort
  Service on `192.168.49.2:<nodePort>`.
- The certificate `*.egypteam.com` (Let's Encrypt) already covers any new subdomain.

## Scope

- Deploy the Music Catalog static web application to the `music-catalog` namespace
  on the `etops` minikube cluster.
- Expose it at `https://music-catalog.egypteam.com/`.
- Provide the container image, Kubernetes manifests, and host Apache2 virtual host
  configuration.
- Document, but do not block on, an automated CI/CD push-to-cluster workflow.

## Design

### Image

A minimal image builds or serves the static Vite output. The Dockerfile lives in
the repo and copies the built `apps/web/dist` directory into an nginx container.
An unprivileged nginx user is used where the base image supports it.

The image tag follows the pattern used by other deployments on this cluster:
`music-catalog:deploy-<UTCYYYYMMDDHHMMSS>`. The image is loaded into the node's
Docker daemon with `minikube image load -p etops`, so no registry credentials are
required at runtime.

### Kubernetes manifests

Stored under `deploy/kubernetes/`:

- `namespace.yaml` — `music-catalog` namespace (already applied).
- `deployment.yaml` — Deployment with `replicas: 1`, the loaded image, and
  `imagePullPolicy: IfNotPresent`. Uses stable resource requests/limits.
- `service.yaml` — NodePort Service on port `80` exposing the deployment, with an
  unused static `nodePort` allocated in the cluster's configured range.

### Host Apache2 virtual host

Pattern matching neighboring sites on `ci.egypteam.com`:

- 443 vhost with `ServerName music-catalog.egypteam.com`, `ProxyPreserveHost On`,
  `ProxyPass / http://192.168.49.2:<nodePort>/`, and the Let's Encrypt
  `egypteam.com` certificate.
- 80 vhost redirecting to HTTPS.
- `RequestHeader set X-Forwarded-Proto https` so the app sees HTTPS.

### CI workflow

An optional GitHub Actions workflow builds the image and (given cluster access)
loads it into the node. This is documented as follow-up because cluster access is
per-developer via SSH keys; the primary path is manual load during this feature.

## Acceptance Criteria

- `kubectl -n music-catalog get deploy,svc,pods` shows the Deployment and Service
  ready with the pod `Running` and `1/1`.
- `curl -I https://music-catalog.egypteam.com/` returns `200` with the SPA HTML.
- The root page HTML loads its hashed `/assets/*` assets `200`.
- IndexedDB-dependent catalog operations work over HTTPS (manual browser check).

## Validation

- `music-catalog` namespace created on the `etops` cluster.
- Image `music-catalog:deploy` built from the static `apps/web/dist` on
  `nginxinc/nginx-unprivileged:1.27-alpine` (listens on `8080`), loaded into the
  node's Docker via `minikube image load -p etops`.
- Deployment and NodePort Service (`30230`) applied; pod reaches `1/1 Running`.
- Host Apache2 vhosts `123/124.music-catalog.egypteam.com.{ssl.,}conf` installed;
  `apache2ctl configtest` reports `Syntax OK`.
- `curl -I https://music-catalog.egypteam.com/` → `200`; `/healthz` → `200`;
  HTTP → HTTPS returns `301`.
- Hashed `/assets/*` requests return `200` with `Cache-Control: public, immutable`.
- TLS certificate `*.egypteam.com` (Let's Encrypt) covers the host.
- `npm run check` result recorded in the branch history.

Remaining limitations: image updates require a manual `minikube image load` plus
`kubectl rollout restart`; the CI workflow currently only exports an image tarball
artifact. IndexedDB behavior over HTTPS was smoke-checked in a browser but not
automated against the live host.

## Follow-up

- Push-based CI/CD: build + load image and apply manifests on tag push.
- Horizontal scaling / resource sizing as real usage data appears.
- Observe the container-image retention policy on the node.