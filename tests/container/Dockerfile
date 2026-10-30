FROM python:3.14-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git rsync curl jq procps util-linux ncurses-bin ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir pytest==9.2.0
WORKDIR /repo
