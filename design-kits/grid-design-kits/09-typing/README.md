# Typing panel

Files: typing.js, typing.css.

## API / components

GridKit.typingPanel(props), passageHTML(passage,{index,error}), attachTypingDemo(root,{passage,onProgress}).

## Integration notes

The production integration should retain client/src/game/useTyping.ts. attachTypingDemo is explicitly a local styling demo using correct-progress gating and no official clock. It is not a replacement for correction, IME, Unicode or input validation rules. Visible passage is aria-hidden; the input has an accessible full-passage description. Test screen-reader verbosity, software keyboards, composition and focus in the host. Each state has a clear label; incorrect characters use both background and underline.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
