# ~/.profile: executed by the command interpreter for login shells.
# This file is not read by bash(1), if ~/.bash_profile or ~/.bash_login
# exists.
# see /usr/share/doc/bash/examples/startup-files for examples.
# the files are located in the bash-doc package.

# the default umask is set in /etc/profile; for setting the umask
# for ssh logins, install and configure the libpam-umask package.
#umask 022

# if running bash
if [ -n "$BASH_VERSION" ]; then
    # include .bashrc if it exists
    if [ -f "$HOME/.bashrc" ]; then
        . "$HOME/.bashrc"
    fi
fi

# set PATH so it includes user's private bin if it exists
if [ -d "$HOME/bin" ] ; then
    PATH="$HOME/bin:$PATH"
fi

PATH=$PATH:/bin/su:/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin/quickbox/system:/usr/bin:/usr/local/bin/quickbox/system/auxiliary:/usr/bin:/usr/local/bin/quickbox/system/theme:/usr/local/bin/quickbox/package:/usr/local/bin/quickbox/package/install:/usr/local/bin/quickbox/package/remove:/usr/local/bin/quickbox/package/update:/usr/local/bin/quickbox/plugins:/usr/local/bin/quickbox/plugins/install:/usr/local/bin/quickbox/plugins/remove: