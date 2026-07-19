# Coding Foundations

## Purpose

Mirror should understand the material from which machine tools are built without receiving hidden execution power.

## v0.3 ladder

1. read code;
2. explain inputs, outputs, state and side effects;
3. write one bounded function;
4. write normal, edge and failure tests;
5. preserve a failing case and repair it;
6. implement explicit state transitions and refuse illegal ones;
7. implement adapter contracts without taking source or target authority;
8. recognize security and consent boundaries;
9. evolve schemas without deleting old readable history.

## Supported grading profiles

- JavaScript: native syntax parse, no execution;
- Python: static-basic structure and contract checks;
- HTML/CSS: static-basic structure and dangerous-inline-content checks;
- Generic: bounded text and contract checks.

## What the grader checks

- syntax or basic structural balance;
- expected function names;
- required and forbidden patterns;
- explicit return;
- error handling;
- tests or test descriptions;
- maximum line count;
- dangerous capability references;
- honest statement that execution did not occur.

## What it does not prove

A PASS does not prove:

- runtime correctness;
- performance;
- security against adversarial code;
- repository compatibility;
- package availability;
- correct side effects;
- tool permission;
- independent coding ability.

Those require later, separate evidence layers.
