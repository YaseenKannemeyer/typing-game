# Brand

Files: brand.js, brand.css, mark.svg, wordmark.svg, favicon.svg / favicon.ico, icon-32/180/192/512.png, invite-preview.svg, invite-preview-1200x630.png.

## API / components

GridKit.mark(size), wordmark(), loading(label).

## Integration notes

Use the PNG invite preview at a public HTTPS URL in og:image, with og:image:width=1200 and og:image:height=630. SVG is the editable original. The 180 px icon can serve apple-touch-icon; 192/512 px icons suit a web manifest. Keep a 1/4-mark clear space around the mark. Minimum standalone mark size: 24 px. Brand text is a placeholder if the actual application has another name. Do not imply the sample room code is live.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
