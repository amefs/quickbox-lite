FROM node:24-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx sudo openssl rsync curl python3 procps util-linux iproute2 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/local/bin/node /usr/bin/node
WORKDIR /opt/quickbox-source
COPY setup/dashboard/ws/package*.json setup/dashboard/ws/
RUN cd setup/dashboard/ws && npm ci
COPY . .
COPY --from=baseline / /opt/quickbox-baseline/
RUN cd setup/dashboard/ws && npm run build \
    && cd /opt/quickbox-baseline/setup/dashboard/ws && npm ci --omit=dev
ENV QUICKBOX_TEST_DISPOSABLE=1
CMD ["python3", "tests/deployment/run.py"]
