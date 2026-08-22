# 8. Beginner explanation for Mike

Think of every controller as speaking a different language.

A phone says:

```text
thumb moved 30 pixels left
```

A keyboard says:

```text
A key is held
```

An Xbox-style controller says:

```text
left stick x is -0.62
```

The game should not need to understand all three languages.

This system puts a translator between the device and the game. Every translator outputs:

```text
MOVE left by 0.62
```

The game only understands `MOVE`. That is the important part.

It means:

- the phone remains a real supported controller;
- a physical controller can be more precise without becoming mandatory;
- keyboard and handheld controls work through the same route;
- future accessibility devices can join by adding a translator;
- a new game reuses the control system instead of rebuilding it.

The current Robo Pong controls are not thrown away. The bridge translates the new `MOVE` action back into the old left/right fields. That lets us prove the new system without risking the working game.
