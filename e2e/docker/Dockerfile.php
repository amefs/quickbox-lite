FROM php:8.2-fpm

# Install required PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Create mock /proc/cpuinfo
RUN mkdir -p /mock/proc && \
    echo 'processor\t: 0\nmodel name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 35840 KB\n\nprocessor\t: 1\nmodel name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 35840 KB\n\nprocessor\t: 2\nmodel name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 35840 KB\n\nprocessor\t: 3\nmodel name\t: Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz\ncpu MHz\t\t: 2400.000\ncache size\t: 35840 KB' > /mock/proc/cpuinfo

# Create dashboard db directory with mock data
RUN mkdir -p /srv/dashboard/db/session_5sec && \
    echo 'testuser' > /srv/dashboard/db/master.txt && \
    echo 'eth0' > /srv/dashboard/db/interface.txt && \
    echo '' > /srv/dashboard/db/output.log

# Create mock /install directory with lock files
RUN mkdir -p /install && \
    touch /install/.rtorrent.lock \
          /install/.transmission.lock \
          /install/.qbittorrent.lock \
          /install/.filebrowser.lock \
          /install/.syncthing.lock \
          /install/.ttyd.lock \
          /install/.fail2ban.lock \
          /install/.netdata.lock

# PHP config tweaks for testing
RUN echo 'display_errors = On' > /usr/local/etc/php/conf.d/testing.ini && \
    echo 'error_reporting = E_ALL' >> /usr/local/etc/php/conf.d/testing.ini && \
    echo 'log_errors = On' >> /usr/local/etc/php/conf.d/testing.ini

WORKDIR /srv/dashboard
