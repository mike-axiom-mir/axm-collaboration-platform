# Workspace-local Tool Forge package proof

Status: `TEST`

The required Tool Forge package test previously wrote a persistent
`EXPERIMENTAL` ZIP through Node's host `os.tmpdir()`. On this Windows machine,
that meant C-temp even though the live Workshop is rooted on D.

The repair keeps package construction pure and makes the filesystem proof:

1. create a unique run directory under
   `state/test-scratch/agent-tool-forge` inside the current Workshop;
2. write the built ZIP there;
3. read it back and require exact byte equality;
4. record its byte length and SHA-256 in the command receipt;
5. remove the transient run directory before returning;
6. preserve `installed: false`.

The policy is workspace-local rather than a hard-coded D path. That makes the
current D Workshop stay on D while keeping extracted public copies portable.
User-initiated browser downloads remain controlled by the user's browser and
download settings; this repair covers the repository's required Node package
proof only.

The post-reproduction baseline contains 174 matching package-proof ZIPs in
Windows OS temp. One is the exact diagnostic ZIP created to reproduce this bug;
the current execution policy refused its deletion, so it remains named by hash
in the verification receipt. The focused test treats the observed set as a
baseline and requires it not to grow. The remaining historical files were not
deleted because bulk retention cleanup is a separate authority and review
decision.
