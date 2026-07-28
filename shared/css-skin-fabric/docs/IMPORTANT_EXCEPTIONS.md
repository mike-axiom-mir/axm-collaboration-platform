# Tracked `!important` Exceptions

The pack contains six deliberate `!important` declarations. They are not available to component authors.

- **Forced colors:** suppress decorative `box-shadow` and `text-shadow`.
- **Reduced motion:** override component animations and smooth scrolling globally.
- **Hidden state:** preserve the native `[hidden]` contract over component display rules.

`tools/validate_pack.py` compares the actual file counts with `registry/important-exceptions.json` and fails when an unregistered occurrence appears or an expected occurrence disappears.
