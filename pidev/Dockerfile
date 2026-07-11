FROM node:26-trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  git \
  openjdk-25-jdk-headless \
  curl \
  wget \
  podman \
  podman-docker \
  podman-compose \
  maven \
  postgresql \
  postgresql-client \
  procps \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent playwright
RUN playwright install-deps && playwright install chromium

RUN pi install git:github.com/obra/superpowers

WORKDIR /workspace
ENTRYPOINT ["pi"]
