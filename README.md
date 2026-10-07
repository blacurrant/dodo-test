# Tokens

**Everything you type gets metered.**

AI products are billed by the token, and that's what Dodo Payments meters for its customers. This toy makes tokens something you can hold.

Type anything. Each word is split by the real `o200k_base` tokenizer (the one GPT‑4o and GPT‑5 use), and its tokens lift out of the input as physical tiles, drop onto a shelf and clack as they land. A receipt printer itemizes every word: its token split, the token count and the cost. When you're done, **bill the pile**: the tiles feed into the printer's slot, the receipt is stamped **PAID** and torn off, and a fresh numbered receipt feeds out.

## Why it's worth playing with

- **You find things out.**
  - " strawberry" is one token mid-sentence, but at the start of a line it's `st|raw|berry`.
  - "Dodo" is `D|odo`, and typing it summons a dodo. It drops in, chirps, the pile hops to greet it, and it prints as its own lime line on the receipt.
  - It's one of **six secret words**, all from Dodo Payments' world, and the shelf keeps count of how many you've found. The others: a refund that strikes the last line off the receipt, a subscription that keeps renewing itself, a fraud check that flags a word and throws it off the shelf, checkout, and a rain of currencies. Refunded and blocked tokens leave the pile and the total together, so the bill always stays honest.
  - Emoji shatter into raw bytes: 🦤 becomes `F0 9F` `A6` `A4`.
  - The same sentence costs about 1.7× the tokens in Hindi and 2.3× in Japanese: the same meter, a different bill.
- **It's an instrument.** Every token is a marimba note. Pitch comes from the token's ID on a pentatonic scale, so any sentence stays in key and the same word always sounds the same. Tap tiles in the pile to play them.
- **It's a fidget toy.** Drag and throw tiles, click empty space to poke the pile, or shake it.
- **Colour means something.** A tile's colour is how rare the token is: common tokens like " the" are white, the long tail is blue, green and orange, and the rarest are Dodo lime. Byte fragments are black.

## Craft notes

- **Words lift out of the input in place.** While you type, the composer shows the word's tokens splitting live. When you press space, the physics tiles spawn exactly where those chips were.
- **The meter is a receipt printer**, because Dodo is a Merchant of Record and receipts are its product.
  - Each word prints a line item, with its tokens underlined in their rarity colour.
  - The paper feeds up out of the slot, and the barcode is generated from the receipt's own token IDs.
  - When the pile gets full, it bills itself, so the receipt always matches the pile.
- **The money adds up.** Costs are derived from an integer token count at $2.50 per million tokens, so totals never drift. The printer's Billed display ticks up as each tile lands in the slot, and a test checks that billed equals what was on the receipt.
- **Performance.** Matter.js steps at a fixed 120 Hz, and tiles are DOM elements, so the type stays crisp. Only moving tiles are redrawn each frame. The tokenizer vocabulary (about 1 MB gzipped) loads after the page paints; the page itself is about 40 kB gzipped. It measured a steady 60 fps on Apple silicon, including a 150-token paste and shaking the full pile.
- **Sound.** Everything is synthesized with Web Audio and there are no audio files: marimba notes, wood-block clacks, coin ticks and a register "ka-ching".
- **Look.** It sits in Dodo's visual world: white, a dot grid, thin framing rails and one lime. The soft pastel background is Paper Shaders' `MeshGradient`.

## What I'd explore next

- **Compare tokenizers.** Show the same sentence through different models' tokenizers side by side, with a different bill for each.
- **Share a pile.** Save your pile as an image or a link, like a receipt for a sentence.
- **Credits.** A prepaid balance that drains as you type, the way AI products actually bill. Hit zero and the input locks until you top up.
- **Phones.** Tilt the phone to slide the pile around (device orientation), with a little vibration when tiles land.

## Run it

```sh
pnpm install
pnpm dev                    # http://localhost:5173
pnpm test                   # unit tests (token commit rules, money, tokenizer cases)
pnpm build && pnpm smoke    # headless test of the production build
```

`/` is the toy. `/scrap/` keeps my first idea, a shader card I set aside, as scrap work.

Stack: React, Vite, TypeScript, Matter.js, `gpt-tokenizer`, `@paper-design/shaders-react`, Motion.
