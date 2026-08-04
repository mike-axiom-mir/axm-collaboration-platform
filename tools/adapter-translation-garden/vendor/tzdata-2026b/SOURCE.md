# Bundled timezone data

This directory contains the compiled TZif files named by IANA `zone.tab` and
`zone1970.tab`, plus `UTC`, from tzdb version **2026b**. The files were copied
from the Git for Windows runtime already installed on Mike's laptop:

`C:\Program Files\Git\mingw64\share\zoneinfo`

The tzdb source declares itself public domain. AXM bundles this bounded subset
because CPython on Windows does not ship an IANA timezone database. The
temporal semantics translator first uses the host database and falls back to
these files without changing global timezone state.

This is data, not authority: it performs no network access, installation,
system configuration, or native write.
