#!/usr/bin/env python
# SPDX-License-Identifier: GPL-3.0-or-later
# Changes the password for Deluge's Web UI

from __future__ import print_function
from deluge.config import Config
import hashlib
import os.path
import sys

try:
    input = raw_input
except NameError:
    pass

if len(sys.argv) == 2:
    deluge_dir = os.path.expanduser(sys.argv[1])

    if os.path.isdir(deluge_dir):
        try:
            config = Config("web.conf", config_dir=deluge_dir)
        except IOError as e:
            print("Can't open web ui config file: ", e)
        else:
            password = input("Enter new password: ")
            s = hashlib.sha1()
            s.update(config['pwd_salt'])
            s.update(password)
            config['pwd_sha1'] = s.hexdigest()
            try:
                config.save()
            except IOError as e:
                print("Couldn't save new password: ", e)
            else:
                print("New password successfully set!")
    else:
        print("%s is not a directory!" % deluge_dir)
else:
    print("Usage: %s <deluge config dir>" % (os.path.basename(sys.argv[0])))
