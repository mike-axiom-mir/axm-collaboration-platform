# QA Matrix

Every reusable text style should survive:

- smallest supported phone width;
- largest desktop width;
- TV distance at 1080p and 4K;
- 200% user scale;
- a bright, dark, noisy, and moving background;
- one long translated string with 35% expansion;
- RTL direction with mixed numbers and Latin text;
- missing custom font fallback;
- reduced-motion mode;
- high-contrast mode;
- screenshot regression on each supported platform.

A style fails release if content clips, becomes unreadable, requires two-axis scrolling, loses meaning without color, or depends on a proprietary font that is not packaged legally.
