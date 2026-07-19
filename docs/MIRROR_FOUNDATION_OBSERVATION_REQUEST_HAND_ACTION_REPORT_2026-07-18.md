# Mirror Foundation observation-request hand action report

Status: TEST automatic request hand, not CANON.

## Need

The Foundation observatory was explicit and manual. That preserved authority,
but it also meant a changed Foundation could remain unmeasured until a steward
remembered to run it. A second seam existed inside the longitudinal comparison:
new verified evidence on unchanged source bytes was excluded as though it were
an exact repeat.

## Hard-coded organ

`organs/foundation-development-observation-request-organ.js` compares the exact
current Foundation source digest plus the verified evidence digest with every
immutable observatory snapshot.

- An exact source-plus-evidence match returns
  `NO_NEW_OBSERVATION_REQUIRED` and writes nothing.
- An unseen exact combination returns `OBSERVATION_REQUIRED` and writes one
  content-addressed private request.
- Repeating an unfulfilled request reuses the identical immutable bytes.
- A changed request file is refused rather than silently replaced.

The comparison in the observatory was also repaired: same-source observations
with different evidence are now longitudinally compared, while an exact repeat
is excluded so its content-addressed identity remains stable.

Workshop practice invokes the request hand after its reasoning cycle. The hand
does not invoke the observer. `automaticFoundationDevelopmentObservation`
therefore remains `false`; only the bounded request is automatic.

## Operational falsification

The final live exercise produced request
`foundation-observation-request-435f98f87526072221aace6a` because no prior
snapshot bound subject
`892994affe504f461296a81c101057bf72c0740d608bc34462f0b0dd8747e034`
with evidence digest
`d73d9b1668009d0e2cbaa3775056168e929a8ffbe2cff349790626691f5aebb1`.

The request itself executed zero observations, training admissions, repairs,
promotions, permission grants, or world actions. A separately invoked manual
observer then created
`foundation-development-bfa397f550a3f17f8e1c2ec8`. It retained eight
observed dimensions, two explicit evidence holds, and zero regressions while
comparing three prior Foundation subjects. An exact observer rerun reused the
same snapshot. The next automatic request check found that exact snapshot,
returned `NO_NEW_OBSERVATION_REQUIRED`, and wrote no duplicate request.

The two stored operational request directories preserve the intermediate and
final source states from implementation. They are append-only lineage, not two
outstanding requests.

## Tests and limits

Four focused hand tests passed. Together with the five observatory tests, 9/9
focused checks passed. The complete integrated Mirror suite passed 162/162,
including the live settled-Workshop relational check.

This hand detects missing observation coverage. It cannot decide whether a
change is good, perform an observation, average dimensions, create an
intelligence score, train, repair, change a model, grant permission, promote
runtime or canon, or act in the world. The real-negative-experience and
outside-authored-language-exam gates remain open.

## Artifact hashes

- `organs/foundation-development-observatory-organ.js` —
  `bff01c169c51575dd027a9d87a4b0760eefdac4725da88720eaef111c762f526`
- `organs/foundation-development-observation-request-organ.js` —
  `e05ce36a2a20f510ddee3789fa8462b21d6ff2dd0bb7b785b7eb5d5380ea4a1f`
- `contracts/foundation-development-observation-request.schema.json` —
  `381e3f44852e031373633a4409ca13c0debf240ba7dea1c163334febf04de18e`
- `scripts/run-foundation-development-observation-request.js` —
  `661194c153d8ca2413c5a96066b0c33815e457ebbbd5222e0cab20ec6938f3b2`
- `tests/foundation-development-observation-request-organ.test.js` —
  `9c4398ecdc1d8144cea4d1f43229a34dd63e84a5056386d4a306e1b2fa543d2e`
- `training/TRAINING_POLICY.json` —
  `c61df6e6188d6a055e1ff9d3a6d1cd57fab24fa208a4518a8fe2e4dc91d113b9`
- final private request file —
  `b7104e80ba355c58a16a741778896cc688d9f71d458d76a653eb3153044c1b89`
- fulfilled private snapshot file —
  `10bee4a0b72edb2b01da23abfe621476e3685433685621f7db6fafc72bc5da16`

Later source edits must supersede these hashes rather than silently inheriting
this result.
