#!/usr/bin/env python
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Deluge hostlist id generator
#
#   deluge.addHost.py
#
#

from __future__ import print_function
from builtins import str
import hashlib
import time

print(hashlib.sha1(str(time.time()).encode('utf-8')).hexdigest())
