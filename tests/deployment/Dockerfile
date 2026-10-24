FROM node:24-slim
ENV DEBIAN_FRONTEND=noninteractive
ENV npm_config_cache=/opt/quickbox-npm-cache npm_config_audit=false npm_config_fund=false
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx sudo openssl rsync curl python3 procps util-linux iproute2 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/local/bin/node /usr/bin/node
WORKDIR /opt/quickbox-source
COPY setup/dashboard/ws/package*.json setup/dashboard/ws/
RUN cd setup/dashboard/ws && npm ci
COPY --from=baseline / /opt/quickbox-baseline/
RUN cd /opt/quickbox-baseline/setup/dashboard/ws && npm ci --omit=dev
RUN mkdir /tmp/quickbox-offline-check \
    && cp setup/dashboard/ws/package*.json /tmp/quickbox-offline-check/ \
    && cd /tmp/quickbox-offline-check && npm ci --offline --omit=dev \
    && rm -rf /tmp/quickbox-offline-check
COPY . .
RUN cd setup/dashboard/ws && npm run build
ENV QUICKBOX_TEST_DISPOSABLE=1
ENV npm_config_offline=true
CMD ["python3", "tests/deployment/run.py"]
