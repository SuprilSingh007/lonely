# Ghulo Milo — Design Language

> *Ghulo Milo* (घुळो मिळो, roughly "mingle and meet") matches people in the same Pune suburb by a specific shared interest, without photos, names or gender.
> The UI has to feel playful, warm and a little bit weird, like a friend's sticker-covered laptop, never like a dating app.

## 1. Personality

| We are | We are not |
| --- | --- |
| Quirky, chatty, a little self-aware | Flirty, glossy, "swipe for love" |
| Warm and local (chai, forts, monsoon, vada pav) | Corporate or globally generic |
| Bold and chunky, with high contrast | Thin, grey and minimal |
| Anonymous by design: people are their interests | Photo-first or looks-first |

**Inspiration:** Bumble's confident, rounded, friendly boldness: big type, pill buttons, one hero colour and a happy tone of voice.
**Deliberately different:** no yellow, no honey or bee motifs. Our hero colour is **Tomato Coral** on **Chai Cream**, outlined in **Plum Ink**.

## 2. Colour

| Token | Name | Hex | Use |
| --- | --- | --- | --- |
| `--paper` / `background` | Chai Cream | `#FFF6EC` | App background |
| `--ink` / `foreground` | Plum Ink | `#24123A` | Text, outlines, hard shadows |
| `--coral` / `primary` | Tomato Coral | `#FF5B45` | Primary actions, "Say hi" swipe, brand |
| `--grape` / `secondary` | Electric Grape | `#6C4CF5` | Links, focus ring, secondary highlights |
| `--mint` | Mint Soda | `#2FD6A4` | Success, online dot, "joined" |
| `--lilac` / `accent` | Lilac Milk | `#E9E1FF` | Soft surfaces, selected chips |
| `--peach` / `muted` | Peach Fizz | `#FFE3D6` | Soft surfaces, inputs, incoming bubbles |
| `--sky` | Monsoon Sky | `#C6E8FF` | Tertiary stickers and tags |
| `card` | Paper White | `#FFFDF9` | Cards and sheets |

Rules:
- One hero colour per screen. Coral marks the main action. Everything else stays ink, cream and soft tints.
- Body text is always Plum Ink on a light surface. Coral text is reserved for short labels at 18px or larger.
- Category colours rotate through coral, grape, mint, sky, lilac and peach, so decks feel different without new hues.
- The app is light-only for the MVP. Dark tokens exist in `index.css` but nothing switches them on yet.

## 3. Type

- **Display:** *Bricolage Grotesque Variable*, weight 700–800, tight letter-spacing (`-0.02em`). Used for headings, handles, big numbers and the logo.
- **Body/UI:** *Geist Variable*, weight 400–600.
- **Scale (mobile → desktop):** hero 40→64, h1 30→40, h2 22→26, body 16, small 14, micro 12.
- Handles (e.g. **Caffeinated Pangolin 27**) always use the display face. They are the only identity a person has, so they get the spotlight.

## 4. Shape and depth: "sticker brutalism"

- **Outlines:** 2px Plum Ink borders on cards, buttons, inputs and chips.
- **Hard shadows:** a flat offset with no blur, `4px 4px 0 var(--ink)` (`shadow-pop`), or `2px 2px 0` for small pieces (`shadow-pop-sm`).
- **Press:** pressing an element moves it `translate(2px, 2px)` and halves its shadow, so it feels physically pushed.
- **Radius:** big and friendly. Cards and sheets use `1.5rem`, buttons and chips are full pills, inputs use `1rem`.
- **Tilt:** stickers, badges and empty-state art sit at -3° to 4°. The swipe card behind the top one is tilted -2°.
- No gradients on UI chrome. Blobs and avatars may use two-tone flat fills.

## 5. Components

- **Button:** a pill with an ink border and hard shadow. Variants:
  - *primary* (coral)
  - *secondary* (grape)
  - *outline* (paper)
  - *ghost* (no border, for toolbars)
  - *destructive* (ink text on peach, for the Block confirmation)
- **Chip / option:** a pill, paper fill when idle, lilac fill and a ✓ when selected. Structured prompts are answered only with chips, never free text.
- **Swipe card:** paper card with a 2px border and a 6px pop shadow. Contents:
  - the handle (display face, 28px+)
  - the interest sticker
  - the AI summary (18px)
  - the "Pass" and "Say hi" stamps, which fade in while dragging (Pass on the left, ink; Say hi on the right, coral)
- **Avatar ("blob"):** no photos, ever. A rounded blob in a colour derived from the handle, showing the handle's initials in the display face.
- **Chat bubble:**
  - Mine: coral with white text, bottom-right corner squared off.
  - Theirs: peach with ink text, bottom-left corner squared off.
  - Both have a 2px ink outline.
- **Tab bar (mobile):** floating pill at the bottom, ink outline, 4 tabs (Discover, Interests, Chats, Me). The active tab gets a coral blob behind its icon.
- **Sidebar (desktop ≥1024px):** the same items, vertical, on cream with a logo sticker on top.
- **Empty states:** a big emoji sticker, a joke-y one-liner and one clear action.

## 6. Motion

- The swipe card follows the finger (drag), rotates up to ±12°, and flies off with a spring. The buttons trigger the same animation.
- Buttons squish on press (translate plus shadow). Lists fade and slide 8px in.
- Typing indicator: three bouncing dots inside a peach bubble.
- Respect `prefers-reduced-motion`: drop the springs and tilts and keep simple fades.

## 7. Layout and responsiveness

- **Mobile first** (360–430px): single column, 16px gutters, bottom tab bar, safe-area padding, 44px minimum touch targets.
- **Tablet** (768px+): wider centred content (max 640px). The deck card grows to 420px.
- **Desktop** (1024px+): left sidebar navigation. Chats become a split view (list on the left, conversation on the right). Content is capped at 1100px.
- Use `100dvh` and safe areas so the chat composer never hides behind mobile browser chrome.

## 8. Voice

- Short, playful, second person, with Pune references:
  - "Your deck is cooking."
  - "That's all 20 swipes for today. Go touch some Sahyadri grass."
- Never shame people for passing or being passed. Passing is a "maybe later", not a rejection.
- Safety copy is plain and calm: "Blocked. They can't see you or message you anymore."

## 9. Privacy rules the UI must enforce

- Never show photos, real names, gender or phone numbers to other users.
- Show age **only inside a chat**, never on deck cards.
- Profiles are built from structured prompts only. There are no freeform bio fields anywhere.
