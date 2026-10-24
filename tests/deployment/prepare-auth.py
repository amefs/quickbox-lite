#!/usr/bin/env python3
"""Generate disposable identity-provider configuration, never user credentials."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(sys.argv[1])
for name in ['authelia', 'vouch']:
    (root / name).mkdir(parents=True, exist_ok=True)
    (root / name).chmod(0o755)
output = subprocess.check_output(['docker', 'run', '--rm', '--pull=never', '--network=none', 'authelia/authelia:4.39.28',
                                  'authelia', 'crypto', 'hash', 'generate', 'argon2',
                                  '--password', 'fixture-password'], text=True)
digest = re.search(r'Digest: (\S+)', output).group(1)
(root / 'authelia/users_database.yml').write_text(f'''
users:
  fixture:
    displayname: Fixture Admin
    password: '{digest}'
    email: fixture@example.com
    groups: [admins]
''')
(root / 'authelia/configuration.yml').write_text('''
server:
  address: tcp://0.0.0.0:9091/authelia
log:
  level: info
ntp:
  disable_startup_check: true
identity_validation:
  reset_password:
    jwt_secret: disposable-fixture-reset-secret-0123456789
identity_providers:
  oidc: null
authentication_backend:
  file:
    path: /config/users_database.yml
access_control:
  default_policy: deny
  rules:
    - domain: dashboard.example.com
      policy: one_factor
session:
  secret: disposable-session-secret-0123456789abcdefghijklmnopqrstuvwxyz
  cookies:
    - domain: dashboard.example.com
      authelia_url: https://dashboard.example.com:18443/authelia
      default_redirection_url: https://dashboard.example.com:18443/
storage:
  encryption_key: disposable-fixture-storage-secret-0123456789
  local:
    path: /config/db.sqlite3
notifier:
  filesystem:
    filename: /config/notifications.txt
''')
(root / 'vouch/config.yml').write_text('''
vouch:
  listen: 0.0.0.0
  port: 9090
  logLevel: info
  domains: [example.com]
  jwt:
    secret: disposable-fixture-vouch-signing-secret-0123456789abcdefghijklmnopqrstuvwxyz
  cookie:
    name: VouchCookie
    maxAge: 60
    httpOnly: true
    secure: true
    domain: example.com
  session:
    key: disposable-fixture-vouch-session-secret-0123456789abcdefghijklmnopqrstuvwxyz
  headers:
    jwt: X-Vouch-Token
oauth:
  provider: oidc
  client_id: fixture-client
  client_secret: fixture-client-secret
  auth_url: https://dashboard.example.com:18443/fixture-idp/authorize
  token_url: http://127.0.0.1:9093/token
  user_info_url: http://127.0.0.1:9093/userinfo
  callback_url: https://dashboard.example.com:18443/auth/vouch/callback
  scopes: [openid, email, profile]
''')
