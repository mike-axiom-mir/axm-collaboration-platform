# AXM Universal Component Protocol v1

UCP gives tiny reusable design and production pieces the same simple roots
without pretending they need the same renderer or validator.

Examples include a colour token, gradient, type scale, UI component, material,
lighting rig, mesh part, scene template, animation curve, interaction rule,
audio motif, print treatment or manufacturing constraint. A component is data
and references; it is not an agent, permission, executable hand or approval.

## Three portable contracts

- `axm.universal-component/v1` seals one exact version, its typed ports,
  supported canvases, capabilities, artifact references, provenance, resource
  pressure and verification ceiling.
- `axm.universal-component-graph/v1` connects exact component digests into an
  acyclic graph for one `axm.target-canvas/v1`.
- `axm.universal-component-composition-receipt/v1` proves graph integrity,
  resolution, port compatibility, canvas compatibility and a resource plan.

`READY_CONTRACT` never means rendered, beautiful, manufactured or applied. It
means compatible pieces and required capabilities are known. Asset Hands still
perform work. Category validators still prove technical facts. Humans or
appointed machine reviewers still judge appearance and meaning.

## Same roots, different truths

Every component declares:

1. stable identity and version;
2. immutable digest;
3. typed inputs and outputs;
4. canvas compatibility;
5. provided and required capabilities;
6. small JSON payload plus digest-bound large artifact references;
7. provenance and licence;
8. CPU, GPU, memory, storage and native-runtime pressure;
9. automatic checks, human judgments and assurance ceiling.

Large data never belongs inside the component payload. Use a portable relative
reference or a future vault address such as `axm-vault://...`; absolute drive
letters and `file:` paths are refused so the same graph can move from laptop to
gamepad or another body.

Adapters are ordinary components with one additional obligation: they name the
required executable hand and every known loss. A graph may declare losses or
refuse them. Merely inserting an adapter never performs a conversion.

## Relationship to Asset Fabric

Asset Fabric may attach a validated UCP graph and receipt to a candidate. That
binding becomes part of the candidate digest, invalidates earlier votes, enters
the independent review packet and survives promotion into the immutable shared
vocabulary. Existing candidates and Asset Hand v1/v2 results remain readable.

The first release is intentionally a protocol and composition planner, not a
universal renderer. Later hands can emit or consume UCP components without
changing the root contract.
