# AXM Code Route Knowledge — design receipt

Status: TEST

Purpose: preserve *how code bodies combine to produce a target artifact*, not merely what each language means in isolation.

A route is directional and evidence-bound. `worksWith` is never a bare boolean.

Every route must state:

- source language/family
- destination language/family or host/runtime
- route class
- direction
- exchanged artifact or contract
- purpose / why this route exists
- preconditions
- failure boundaries
- verification candidates
- portability notes
- whether the relation is direct, adapter-bound, process-bound, network/protocol-bound, or build-time only
- authority = NONE

Core route classes:

1. SAME_RUNTIME_IMPORT — modules share one runtime/module system.
2. COMPILE_LINK — sources compile/link into one native artifact.
3. FFI_ABI — one runtime/language calls another through an ABI/foreign-function boundary.
4. EMBED_RUNTIME — an application embeds another language runtime/interpreter.
5. EXTEND_RUNTIME — native/foreign code extends a host runtime.
6. TRANSPILE_GENERATE — one language/tool emits another source/body or generated bindings.
7. COMPILE_TARGET — a language compiles into a portable/intermediate target such as WebAssembly.
8. HOSTED_DSL — a host application/tool consumes a DSL/query/config/schema body.
9. SHADER_PIPELINE — host code binds shader stages/resources through a graphics pipeline contract.
10. SCHEMA_CODEGEN — schema/API definitions generate or constrain code on one or more sides.
11. PROCESS_IPC — independent processes communicate over pipes/sockets/shared-memory/RPC.
12. NETWORK_PROTOCOL — separately deployed components communicate through an explicit protocol/API contract.
13. DATA_QUERY_BOUNDARY — application code invokes query/data languages through a database/query engine.
14. BUILD_ORCHESTRATION — build/config languages select, compile, package or connect other code bodies.
15. INFRA_DEPLOYMENT — infrastructure/config code deploys or configures executable artifacts; it does not become application code.
16. TEST_HARNESS — test/spec/pattern languages observe or drive another code body.
17. HARDWARE_INTERFACE — software/firmware interacts with HDL/device boundaries through registers, buses, drivers or generated interfaces.
18. FILE_DATA_CONTRACT — languages exchange serialized files/data without direct code calling.

Truth boundary:

- route existence does not prove a specific toolchain is installed.
- language compatibility does not prove ABI/type/memory compatibility.
- generated bindings do not prove runtime compatibility.
- successful syntax/build does not prove semantic correctness.
- a route recommendation does not authorize install, execution, mutation, deployment, language switching or CANON changes.

Research anchors used for the initial bridge semantics include current official documentation for WebAssembly/JavaScript imports and exports, CPython extension/embedding, Java native interoperability (JNI/FFM family), and .NET native interoperability/ABI guidance. These sources justify separating route *classes* rather than treating “language A works with language B” as one relation.
