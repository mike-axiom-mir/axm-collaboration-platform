# Truth facets

Mirror Core does not compress truth into one status ladder. Origin, representation, verification, connection, physical status, and operational status answer different questions and can change independently.

| Facet | Question | Examples |
|---|---|---|
| `origin` | Where did this representation originate? | `world_native`, `platform_native`, `real_import`, `generated`, `user_entered`, `adapter_import`, `unknown` |
| `representation` | What kind of thing is stored? | `visual_only`, `text_description`, `structured_model`, `executable_model`, `measured_record`, `external_reference` |
| `verification` | What checking supports it? | `unverified`, `schema_valid`, `simulated`, `tested`, `evidence_supported`, `independently_checked`, `failed`, `disputed` |
| `connection` | How is it connected to a native system? | `disconnected`, `read_only`, `proposal_only`, `approved_sync` |
| `physical_status` | What can be claimed physically? | `not_applicable`, `not_evaluated`, `approximate`, `simulated`, `physically_tested`, `measurement_backed`, `contradicted` |
| `operational_status` | Is it operational in its own domain? | `concept`, `planned`, `prototype`, `active_local`, `archived`, `retired`, `mirrored_real_operation` |

An entity may be `schema_valid` and `prototype` while its physical status is still `not_evaluated`. A simulation may improve the verification facet without making the thing physically built. A mapping may be active while still being `representation_only`.

## Update rule

Every facet update is an explicit packet operation. A downgrade along an ordered facet is blocked unless the packet carries explicit downgrade approval. Failure, dispute, and contradiction are not hidden as a downgrade; they are legitimate new evidence states and stay visible.

Unknown measurements remain `null` or are named in `truth_unknowns`. The system never invents mass, moisture, density, strength, geometry, safety, or physical validity to make a fixture appear complete.

## Evidence rule

Verification claims must name their evidence and limitations. The local verifier proves only that the target mock adapter revision and state hash match its application receipt. It cannot prove a structure is safe, a material measurement is correct, or a real workflow occurred.
