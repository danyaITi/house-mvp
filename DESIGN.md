---
name: Domovid
description: A calm and trustworthy constructor for a future home
colors:
  terracotta: "#9b4f38"
  terracotta-deep: "#733725"
  warm-paper: "#f3efe7"
  warm-paper-deep: "#e8e0d2"
  graphite: "#282621"
  muted-graphite: "#6f695f"
  construction-rule: "#cfc5b6"
  focus-teal: "#2c6570"
typography:
  display:
    fontFamily: "PT Serif, Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 5.8rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Manrope, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: "11px"
  surface: "14px"
spacing:
  xs: "7px"
  sm: "12px"
  md: "18px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "17px 19px"
  button-selected:
    backgroundColor: "{colors.graphite}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "11px 15px"
---

# Design System Domovid

## Overview

**Creative North Star: "The Comprehensible Model Table"**

Domovid borrows the care and material credibility of an architect's model table while keeping professional CAD complexity out of the customer's path. Warm mineral surfaces make the experience domestic; graphite structure makes it trustworthy; restrained terracotta directs action without pretending that the concept is finished construction documentation.

The house model is the primary evidence. Typography, controls and calculation summaries support the model and explain consequences instead of competing with it.

**Key Characteristics:**

- warm, mineral and quiet rather than technological or glossy;
- one active decision group at a time;
- model, quantities and price always share one source;
- professional accuracy is communicated through clear assumptions, not decorative CAD chrome.

## Colors

Warm Paper is the dominant ground. Graphite carries text and selected controls. Terracotta is reserved for the main action, calculation emphasis and small wayfinding details. Focus Teal remains visually separate from both brand and error states.

**The Scarce Terracotta Rule.** Terracotta identifies action or consequence and should not become a general decoration.

**The Honest Status Rule.** Error, focus and price states must never rely on the same color or on color alone.

## Typography

**Display Font:** PT Serif with Georgia fallback  
**Body Font:** Manrope with Arial fallback

The serif gives the future home emotional weight; the humanist sans keeps parameters, measurements and explanations approachable. Tabular values remain in the body face and use tabular numerals instead of adopting a technical monospace costume.

### Hierarchy

- **Display:** heavy, compressed and balanced for the opening promise only.
- **Headline:** serif titles identify a decision or calculation section.
- **Body:** Manrope at comfortable line height, generally capped near 70 characters.
- **Label:** compact uppercase labels are limited to genuine state or category markers.

**The Plain Language Rule.** A customer-facing label uses household language before construction terminology.

## Layout

The first-run brief pairs a focused form with a live model. The workspace gives the model the largest region, keeps one decision group visible, and limits the persistent estimate to its essential range and assumptions. At narrow widths, Parameters, Model and Calculation become separate sequential views rather than compressed columns.

Spacing follows tight control groups and generous separation between decisions. Desktop panels may scroll independently only when the model remains stable and the current state stays clear.

## Elevation & Depth

Most structure comes from tonal layering and hairline rules. The model frame alone receives a broad ambient shadow because it represents the physical object on the table. Controls remain flat until their state changes.

**The Model Earns Depth Rule.** Shadows belong to the primary model surface, not to every container.

## Shapes

Controls use gently curved corners around 11px. Major surfaces use 14px. Small state markers may be circular, but large buttons and panels do not become pills. Rules remain light and mineral rather than blue-gray SaaS borders.

## Components

### Buttons

- **Primary:** terracotta fill, white text, 11px corners and a modest downward shadow.
- **Selected option:** graphite fill, white text and no decorative glow.
- **Hover:** deepen the fill and move at most one pixel.
- **Focus:** use the dedicated high-contrast teal outline.

### Inputs and fields

Range inputs use the terracotta accent. Segmented choices wrap rather than shrink below comfortable targets. Every group has a visible text legend and a keyboard-operable native control.

### Model frame

The conceptual house sits on a quiet construction plane. The frame carries an explicit Conceptual Model label and a text summary below it. Dragging rotates the model, while fixed facts remain available without canvas interaction.

### Calculation summary

The price is always a range. Region, price date and excluded work remain adjacent. Detailed quantities are disclosed intentionally and never replace the customer summary.

## Do's and Don'ts

### Do

- **Do** keep a ready example visible so the customer never faces an empty technical canvas.
- **Do** explain price changes and preserve the last valid configuration.
- **Do** provide semantic text and table equivalents for canvas information.
- **Do** separate desktop composition from mobile task sequencing.

### Don't

- **Don't** present the preliminary range as a quotation or contractual price.
- **Don't** expose CAD vocabulary before the customer asks for detail.
- **Don't** compress three desktop panels into a narrow mobile screen.
- **Don't** use generic AI gradients, decorative glass or interchangeable icon-card grids.
