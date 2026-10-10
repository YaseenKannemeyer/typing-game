# UI component system

Files: tokens.css, tokens.json, core.js, components.css, icons/*.svg.

## API / components

GridKit.button(), banner(), toast(), copy(), tooltip(), skeleton(), icon().

## Integration notes

Import tokens before component styles. Use semantic buttons, input labels, aria-invalid and described errors. Loading buttons are disabled and aria-busy. Toggles use native checkboxes; tooltip works on focus/hover and supports Escape through the showroom binding. Raw attrs in button() are trusted developer-authored values only. Port to JSX rather than accepting remote markup. Toast messages are polite, not repeated live race statistics. Phone layout uses 44 px controls and stacked panels.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
