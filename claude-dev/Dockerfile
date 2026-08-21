FROM node:26-trixie-slim

ARG UID=1000
ARG GID=1000

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  git \
  openjdk-25-jdk-headless \
  curl \
  wget \
  maven \
  postgresql \
  postgresql-client \
  procps \
  ripgrep \
  gosu \
  openssh-client \
  gnupg \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI isn't in Debian's default repos, so pull it from GitHub's own
# apt repo (keyring-signed, per https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
RUN wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# node:26-trixie-slim ships a preexisting "node" user/group at 1000:1000,
# and host UID/GID passed in via --build-arg can collide with other
# preexisting entries too (e.g. macOS's default GID 20 is Debian's
# "dialout"). Reuse/rename whatever's already sitting on that UID/GID
# rather than assuming groupadd/useradd have a clean slate.
RUN set -eux; \
  if getent group "$GID" >/dev/null; then \
    existing_group="$(getent group "$GID" | cut -d: -f1)"; \
    [ "$existing_group" = "dev" ] || groupmod -n dev "$existing_group"; \
  else \
    groupadd -g "$GID" dev; \
  fi; \
  if getent passwd "$UID" >/dev/null; then \
    existing_user="$(getent passwd "$UID" | cut -d: -f1)"; \
    [ "$existing_user" = "dev" ] || usermod -l dev -g "$GID" -d /home/dev -m "$existing_user"; \
  else \
    useradd -m -u "$UID" -g "$GID" -s /bin/bash dev; \
  fi; \
  usermod -s /bin/bash dev

# ~/.ssh must pre-exist with the right owner/perms before run.sh bind-mounts
# a private key into it at container-start time (the mount target can't be
# created by the entrypoint - it has to already be there in the image).
# github.com's host keys are public, not secret, so baking them into
# known_hosts here is safe and avoids a runtime TOFU prompt/network hop.
RUN install -d -m 700 -o dev -g dev /home/dev/.ssh \
  && ssh-keyscan -t rsa,ed25519 github.com >> /home/dev/.ssh/known_hosts \
  && chown dev:dev /home/dev/.ssh/known_hosts \
  && chmod 644 /home/dev/.ssh/known_hosts

# No --ignore-scripts here: @anthropic-ai/claude-code's postinstall
# (install.cjs) is what fetches the platform-specific native binary —
# skipping it leaves a stub `claude` that errors at runtime.
RUN npm install -g @anthropic-ai/claude-code playwright

# Shared, world-readable location so the browser binaries installed here
# as root are still usable once the entrypoint drops to the "dev" user.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN playwright install-deps && playwright install chromium

# Installed as "dev" (via gosu) so the plugin config lands in
# /home/dev/.claude, not /root/.claude where "dev" could never see it.
RUN gosu dev claude plugin marketplace add anthropics/claude-plugins-official \
  && gosu dev claude plugin install superpowers@claude-plugins-official

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /workspace
EXPOSE 5173 8080 5432

ENTRYPOINT ["/entrypoint.sh"]
CMD ["claude"]
