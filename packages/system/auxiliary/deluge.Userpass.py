#!/usr/bin/env python
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Deluge password generator
#
#   deluge.password.py <password> <salt>
#
#

from __future__ import print_function
import hashlib
import sys

password = sys.argv[1].encode('utf-8')
salt = sys.argv[2].encode('utf-8')

s = hashlib.sha1()
s.update(salt)
s.update(password)

print(s.hexdigest())
