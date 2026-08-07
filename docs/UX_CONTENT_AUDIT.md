# Rarely UX and content audit

## The problem

Rarely is a simple product: **add a pet photo, choose a line, get a talking-pet video.** The site repeatedly keeps explaining after that idea is already clear.

This is not a duplicate-content problem. Each landing page can stand alone. The problem is the amount of visible copy on each individual page.

The fix is not “write tighter paragraphs.” The fix is to remove paragraphs and let the product, examples, controls, and page structure explain the experience.

## The rule for every page

- One page, one job.
- One headline, one supporting sentence, one primary action.
- Show a result before explaining the process.
- Use labels, examples, and previews instead of descriptive paragraphs.
- Never explain the same point twice on the same page.
- Put optional answers inside accordions or help links.
- If removing a paragraph does not make the next action confusing, remove it.

### Recommended visible-copy limits

| Page type | Target before the footer |
| --- | ---: |
| Home | 80–120 words |
| Product landing page | 150–220 words |
| Pricing | 100–150 words |
| Studio step | 30–60 words |
| Guide | 350–600 words, heavily broken into examples |
| Legal | No hard limit; optimize navigation and readability |

These are ceilings, not targets.

## Site-wide UX changes

1. **Make the result the explanation.** A real talking-pet video with a play button communicates more than three sections of copy.
2. **Stop using paragraphs as UI.** Replace them with a three-step strip, a comparison, an example line, a price, or a control.
3. **Use progressive disclosure.** FAQs, photo tips, voice details, privacy details, and failure policies should appear only when requested or when relevant.
4. **Reduce headline theatre.** The Bungee display face is distinctive, but multiple giant all-caps statements make every section feel like another sales pitch. Use it once per page.
5. **Remove decorative microcopy.** Labels such as “field notes,” “practical guide,” “ideas worth trying,” “before you make one,” and repeated format badges add reading without adding decisions.
6. **Keep one CTA label.** Use “Make a video” for the standard flow and “Make a birthday video” for birthday. Avoid cycling through “Choose a photo,” “Make one,” “Make the video,” and “Make my pet talk.”
7. **Keep the footer quiet.** The current footer repeats product positioning and a large set of links. Keep one short product line and group links under Product, Help, and Legal.

## Page-by-page audit

### `/` — Home

**Job:** Make a visitor understand the product and upload a photo.

**Keep:** The headline, one-sentence explanation, upload controls, and one real playable result.

**Cut:** The three large explanatory cards, the emotional quote, the marquee, the second “save the look” sales section, and the second CTA block.

**Better structure:**

```text
Give that look a voice.
Turn one pet photo into a talking video.
[Take a photo] [Choose a photo]

[Large real video playing beside or below the action]

Photo → Pick a line → Get the video
```

The first screen is already the strongest part of the site. The page should end soon after it proves the output.

### `/pricing`

**Job:** Answer “how much?” and start checkout.

**Keep:** `$10`, `3 videos`, `no subscription`, the four included items, refund link, and purchase CTA.

**Cut:** The three process lines inside the ticket, separate Checkout/Delivery/Credits essays, and the large repeated CTA section.

**Better structure:** Price card first, four checkmarks, one small trust row: `Private · Failed generations return the credit · 14-day refund`, then the CTA.

### `/guides`

**Job:** Help someone choose a guide.

**Keep:** The title and guide cards.

**Cut:** The long introduction and the closing sales section.

**Change:** Each card should have a title plus a 10–15 word description. The image and title should carry the card. Add filters only if the guide count grows.

### `/talking-pet-video`

**Job:** Explain the general product and convert.

**Keep:** Hero, one real result, three steps, price, CTA, and at most three collapsed FAQs.

**Cut:** Separate proof copy, the full practical-notes section, the ideas section, related-guide block, repeated fact badges, and the final slogan section.

**Target:** A visitor should reach the CTA after one short scroll, not after reading a complete article.

### `/make-dog-talk`

**Job:** Make the dog-specific use case obvious and convert.

**Keep:** A recognizable dog example, one sample line, three visual steps, price, CTA.

**Cut:** The extended advice about muzzles, situations, delivery, photo ideas, and repeated dog jokes. Put detailed photo advice in a guide linked as “Tips for a better result.”

**Suggested hero:** `Make your dog talk.` / `Choose a photo. Pick the line. Get the video.`

### `/make-cat-talk`

**Job:** Make the cat-specific use case obvious and convert.

**Keep:** A strong cat result, one sample line, three steps, price, CTA.

**Cut:** The long explanation of cat expressions, line-writing advice, scenario ideas, and repeated character copy.

**Suggested hero:** `Give the stare a voice.` / `Turn one cat photo into a talking video.`

### `/personalized-pet-video`

**Job:** Show that the photo and words belong to the user.

**Keep:** `Your pet. Your words.`, one before/after example, privacy note, CTA.

**Cut:** Abstract language such as “one camera roll, one household, and one group chat,” the full personalization theory, three idea cards, and repeated format details.

**Show instead:** `Their photo + your line = their video` with the actual artifacts visible.

### `/pet-birthday-video`

**Job:** Show the multi-pet birthday result and start the birthday flow.

**Keep:** The real demo video, source-photo strip, three steps, CTA.

**Cut:** One of the two large closing promises, explanatory captions that repeat what the visuals show, and the final full-width sales section if the CTA remains beside the demo.

**Better hero:** Let the demo occupy most of the screen. Copy can be only: `A birthday message from the whole crew.` / `Add 1–6 pets. Write the greeting. We make the video.`

### `/guides/pet-video-accents`

**Job:** Help users hear and choose an accent.

**Current mismatch:** The page explains sound mostly through text.

**Keep:** Four accent options, one three-step explanation, and three collapsed FAQs.

**Cut:** The long hero paragraph, paragraph on each accent card, “useful casting rule” section, and repeated explanation that the words do not change.

**Show instead:** Four play buttons using the same sentence. Users should hear the difference rather than read a description of it.

### `/studio/generate`

**Job:** Move the user through photo → line → video.

**Photo step:** Already clear. Keep the two photo buttons and file requirements. No extra marketing copy is needed.

**Line step:** There are too many simultaneous choices: three suggestions, custom voice/text input, four accents, voice selection, and the final action.

**Change:**

- First show the three suggested lines and “Write my own.”
- After a line is selected, reveal a compact `Voice options` row.
- Give accent and voice sensible defaults; do not require users to understand every setting.
- Keep photo tips behind a small help link.

This page needs fewer visible decisions more than it needs shorter prose.

### `/studio/birthday`

**Job:** Add pets, approve the group image, and make the greeting.

**Change the sequence:**

1. Add 1–6 pet photos.
2. Add recipient and greeting.
3. Approve the generated portrait.
4. Make the video.

Do not ask for photos, recipient, message, explain the group behavior, and show the final portrait area at the same time. Each step should contain one instruction and one main action.

### `/studio`

**Job:** Continue a draft or open a video.

**Assessment:** This is appropriately concise. Keep the Drafts and Videos split. Add no explanatory introduction.

**Small improvement:** Make `Create` the visually dominant header action when the library is empty or very small.

### `/studio/videos/[videoId]`

**Job:** Watch, save, or share the result.

**Assessment:** The hierarchy is good. The video is dominant and the status text is brief.

**Cut or delay:** Product feedback should appear after the first download/share action or remain a small secondary link. It should not compete with the result.

### `/studio/credits`

**Job:** Buy three videos and return to the draft.

**Assessment:** Keep this as one purchase card. Avoid adding pricing explanations already answered by `$10 · 3 videos · pay once`.

**Change:** Put the purchase CTA immediately below the price and benefits; `Save for later` stays secondary.

### `/account` and `/account/profile`

**Job:** Manage balance, purchases, profile, and support.

**Assessment:** These are utility pages and are already relatively restrained.

**Change:** Use plain labels and status values. Keep support as direct actions—`Email support`, `Request refund`, `Delete account`—instead of explanatory prose.

### `/contact`

**Job:** Get the user to the right support channel.

**Keep:** The email address and payment-provider links.

**Cut:** Operator and payment-processing paragraphs from the main path.

**Better structure:** Three buttons: `Product help`, `Billing or refund`, `Privacy request`, followed by a small operator note.

### `/privacy`, `/terms`, `/refund-policy`

**Job:** Provide accurate policy information. These pages are the exception to aggressive word limits.

**Do not remove required substance.** Improve access to it:

- Start with a five-line plain-language summary.
- Add a sticky or compact table of contents.
- Use bullets for data handled, providers, retention, user choices, and refund steps.
- Keep the full legal text below the summary.
- Replace personality-heavy titles such as “without the fog” and “fine-print theatre” with plain labels. Legal pages should sound calm and human, not branded or generated.

The refund page can be much shorter visually: `14 days · full refund · even if credits were used`, followed by three numbered request steps.

### `/offline` and video not found

**Job:** Explain the state and give one recovery action.

**Assessment:** These are already concise. Keep them that way.

### `/app`

This is a legacy redirect, not a content page. No redesign is needed.

## Recommended design direction

Keep Rarely's current playful identity. The problem is not the pink, illustration, or bold type; it is that bold treatment is spent on too many messages.

- **Color:** Ink `#241A44`, Pink `#F4458F`, Soft pink `#FF9CC5`, Yellow `#FFE36E`, Cream `#FFFDF8`, Purple `#A98CF4`.
- **Type:** Bungee for one page thesis only; Nunito for all useful reading; DM Mono only for short metadata such as duration and price.
- **Layout:** Product result first, action beside it, supporting facts below it.
- **Signature element:** The real 9:16 talking-pet video. This should be the memorable object on every product page—not another headline, quote, or stack of cards.
- **Aesthetic risk worth taking:** Let a real pet video fill most of the hero while the copy occupies only a small label, one sentence, and one action.

## Priority order

### P0 — Fix the feeling immediately

1. Cut the home page to hero, real result, three steps, footer.
2. Cut the shared product landing-page template to hero, result, steps, CTA, optional FAQs.
3. Simplify the studio line step through progressive disclosure.
4. Reduce pricing to one purchase decision.

### P1 — Make the rest consistent

5. Turn the accent guide into an audio comparison.
6. Break Birthday Studio into one-decision steps.
7. Convert contact into support actions.
8. Add summaries and navigation to legal pages.

### P2 — Final content pass

9. Remove decorative labels and secondary slogans.
10. Standardize CTA names.
11. Delete every paragraph that does not change a decision.

## Success test

Give a new visitor five seconds on each page, then ask:

1. What is this?
2. What will I get?
3. What do I do next?

If the page needs more than the hero and the visible result to answer those questions, the hierarchy is wrong. If it answers them and keeps talking, the extra content should be cut.
