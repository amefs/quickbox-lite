#!/usr/bin/env python3
"""Shared entry point for the standalone sandbox scripts.

A sandbox defines module-level ``test_*`` functions and finishes with
``sys.exit(run_cases(globals(), "..."))``. Cases are discovered from the module
namespace, so adding one only means adding a function -- there is no second list
to keep in sync. ``--list`` prints the case names and ``--case NAME`` runs a
single one, which used to be impossible because ``main()`` always ran them all.
"""
import argparse
import sys


def run_cases(namespace, label):
    """Run every ``test_*`` callable in *namespace*; return a process exit code."""
    cases = [
        (name, value)
        for name, value in sorted(namespace.items())
        if name.startswith("test_") and callable(value)
    ]
    parser = argparse.ArgumentParser(description=label)
    parser.add_argument("--list", action="store_true", help="print case names and exit")
    parser.add_argument("--case", metavar="NAME", help="run a single case")
    options = parser.parse_args()

    if not cases:
        print(f"{label}: no cases defined", file=sys.stderr)
        return 2
    if options.list:
        for name, _ in cases:
            print(name)
        return 0

    if options.case:
        selected = [item for item in cases if item[0] == options.case]
        if not selected:
            print(f"{label}: unknown case {options.case!r}", file=sys.stderr)
            return 2
    else:
        selected = cases

    for name, case in selected:
        case()
        if options.case:
            print(f"{label}: {name} passed")
    if not options.case:
        print(f"{label}: {len(selected)} cases passed")
    return 0
