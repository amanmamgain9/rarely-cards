---
name: reference-image-prompting
description: Decide whether Seedance needs production reference images, choose the smallest non-overlapping set, and write each image prompt from the locked production plan.
---

# Production Reference Planning

Choose references; do not inherit a caller's asset list.

1. Start with zero. Add an image only when pixels resolve important ambiguity that plan text and existing references cannot.
2. Choose smallest set. Reject any image whose unique contribution cannot be named.
3. Combine coupled visual facts. If setting and interface must appear together, create one `production` reference instead of separate environment and interface images.
4. Keep identity in supplied character references; never generate replacement character identity.
5. For each chosen image, describe final pixels: dominant read, composition, spatial layout, stable elements, then aesthetic.
6. Make intended medium unmistakable. Use positive specificity before exclusions.

Keep roles strict:

- `character`: neutral identity sheet; no story action or environment ownership.
- `environment`: physical world and usable staging space; no subjects or interface.
- `interface`: screen composition and UI layout; no subject identity or physical room. A game interface must read as an edge-to-edge gameplay viewport, never an arcade cabinet, arcade hall, monitor, or photographed screen.
- `production`: one integrated final-view composition when environment, interface, or layout only make sense together; no subject identity.
- `style`: rendering, materials, light, and color only; no subject, environment, or layout ownership.

When a brief names existing media, capture its relevant visual grammar without copying logos, characters, or exact proprietary assets.

Before returning set, ask:

- What ambiguity does each image uniquely remove?
- Could one image do work of two?
- Does any image repeat supplied pixels or another candidate?
- Could any image be mistaken for another medium or place?
- Will whole set clarify rather than redirect final video?

Return only provider JSON requested by session.
