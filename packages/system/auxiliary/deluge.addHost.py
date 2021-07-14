#!/usr/bin/env python
#
# Deluge hostlist id generator
#
#   deluge.addHost.py
#
#

import hashlib
import time
from __future__ import print_function

print(hashlib.sha1(str(time.time())).hexdigest())
