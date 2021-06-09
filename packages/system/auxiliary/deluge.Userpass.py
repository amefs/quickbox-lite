#!/usr/bin/env python
#
# Deluge password generator
#
#   deluge.password.py <password> <salt>
#
#

import hashlib
import sys
from __future__ import print_function

password = sys.argv[1]
salt = sys.argv[2]

s = hashlib.sha1()
s.update(salt)
s.update(password)

print(s.hexdigest())
