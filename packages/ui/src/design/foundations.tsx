"use client";

import * as React from "react";
import { Badge } from "@pantry/ui/components/badge";
import { LabelChip } from "@pantry/ui/components/label-chip";
import { PriorityGlyph } from "@pantry/ui/components/priority-glyph";
import { StatusGlyph } from "@pantry/ui/components/status-glyph";
import {
  LABEL_COLORS,
  PRIORITY_LABEL,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABEL,
  type Priority,
} from "@pantry/ui/lib/issue-meta";
import { cn } from "@pantry/ui/lib/utils";
import { useDesignBrand } from "./brand";
import { Section, Specimen, SubSection, TokenName } from "./section";

const GRAY_ROLES = [
  "App background",
  "Subtle background",
  "Element",
  "Hover",
  "Selected",
  "Subtle border",
  "Border",
  "Strong border",
  "Solid",
  "Solid hover",
  "Muted text",
  "Text",
] as const;

const SEMANTIC_TOKENS: ReadonlyArray<{ name: string; note: string; text?: boolean }> = [
  { name: "background", note: "page" },
  { name: "card", note: "raised panels" },
  { name: "popover", note: "menus, dialogs" },
  { name: "secondary", note: "secondary buttons" },
  { name: "muted", note: "wells, segmented track" },
  { name: "accent", note: "hover fill" },
  { name: "selected", note: "active row / nav" },
  { name: "foreground", note: "text", text: true },
  { name: "muted-foreground", note: "secondary text", text: true },
  { name: "faint-foreground", note: "placeholder, hints", text: true },
  { name: "border", note: "hairlines" },
  { name: "border-strong", note: "hover borders" },
  { name: "input", note: "field borders" },
  { name: "ring", note: "keyboard focus" },
];

function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block rounded-md shadow-[inset_0_0_0_1px_var(--border)]", className)}
      style={{ background: color }}
    />
  );
}

export function ColorSection() {
  return (
    <Section
      id="colour"
      title="Colour"
      description="Monochrome. A 12-step neutral scale carries both themes and the primary action; colour appears only where it carries meaning: status, priority (urgent) and user-picked label colours. Everything is OKLCH; greys are pure (chroma 0)."
    >
      <SubSection title="Neutral scale" hint="--gray-1 … --gray-12">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
          {GRAY_ROLES.map((role, index) => (
            <div key={role} className="flex min-w-0 flex-col gap-1.5">
              <Swatch color={`var(--gray-${index + 1})`} className="h-12" />
              <div className="flex flex-col">
                <span className="font-mono text-2xs text-foreground tabular">{index + 1}</span>
                <span className="truncate text-2xs text-faint-foreground" title={role}>
                  {role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Semantic tokens" hint="shadcn variables, mapped onto the scale">
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {SEMANTIC_TOKENS.map((token) => (
            <div key={token.name} className="flex h-8 items-center gap-3">
              {token.text ? (
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-display text-sm font-semibold"
                  style={{ color: `var(--${token.name})` }}
                >
                  Aa
                </span>
              ) : (
                <Swatch color={`var(--${token.name})`} className="size-7 shrink-0" />
              )}
              <div className="flex min-w-0 flex-col">
                <TokenName className="text-xs text-foreground">--{token.name}</TokenName>
                <span className="text-2xs text-faint-foreground">{token.note}</span>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Primary" hint="--primary · monochrome (Q6: c)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { name: "--primary", note: "primary button, logo mark (gray-12)" },
            { name: "--primary-hover", note: "primary button hover" },
            { name: "--primary-foreground", note: "text on primary" },
          ].map((token) => (
            <div key={token.name} className="flex flex-col gap-1.5">
              <Swatch color={`var(${token.name})`} className="h-10" />
              <TokenName className="text-foreground">{token.name}</TokenName>
              <span className="text-2xs text-faint-foreground">{token.note}</span>
            </div>
          ))}
        </div>
      </SubSection>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SubSection title="Status categories" hint="--status-*">
          <Specimen className="flex-col items-stretch gap-0 p-1.5">
            {STATUS_CATEGORIES.map((category) => (
              <div key={category} className="flex h-8 items-center gap-2.5 rounded-sm px-2">
                <StatusGlyph category={category} />
                <span className="text-sm text-foreground">{STATUS_CATEGORY_LABEL[category]}</span>
                <TokenName className="ml-auto">{category}</TokenName>
              </div>
            ))}
          </Specimen>
        </SubSection>
        <SubSection title="Priority" hint="--priority-*">
          <Specimen className="flex-col items-stretch gap-0 p-1.5">
            {[1, 2, 3, 4, 0].map((value) => {
              const priority = value as Priority;
              return (
                <div key={priority} className="flex h-8 items-center gap-2.5 rounded-sm px-2">
                  <PriorityGlyph priority={priority} />
                  <span className="text-sm text-foreground">{PRIORITY_LABEL[priority]}</span>
                  <TokenName className="ml-auto">{priority}</TokenName>
                </div>
              );
            })}
            <div className="flex h-8 items-center px-2 text-xs text-faint-foreground">
              Shapes carry the meaning; only urgent is coloured.
            </div>
          </Specimen>
        </SubSection>
      </div>

      <SubSection title="Label palette" hint="--label-* (curated; users pick one per label)">
        <Specimen className="gap-2">
          {LABEL_COLORS.map((color) => (
            <LabelChip key={color} name={color[0]!.toUpperCase() + color.slice(1)} color={color} />
          ))}
        </Specimen>
      </SubSection>

      <SubSection title="Feedback" hint="state colours: errors, destructive actions, success · always with text or an icon">
        <Specimen className="gap-2">
          <Badge variant="success">Synced</Badge>
          <Badge variant="warning">Token expires soon</Badge>
          <Badge variant="destructive">Revoked</Badge>
          <Badge variant="outline">via MCP</Badge>
          <Badge variant="secondary">12</Badge>
          <Badge variant="outline">Draft</Badge>
        </Specimen>
      </SubSection>
    </Section>
  );
}

const TYPE_SCALE: ReadonlyArray<{ token: string; px: string; use: string; className: string; sample: string }> = [
  { token: "text-4xl", px: "44/48", use: "landing display", className: "font-display text-4xl font-semibold tracking-[-0.03em]", sample: "Leave Linear" },
  { token: "text-3xl", px: "32/38", use: "display", className: "font-display text-3xl font-semibold tracking-[-0.025em]", sample: "Agents work your issues" },
  { token: "text-2xl", px: "24/32", use: "issue title", className: "font-display text-2xl font-semibold tracking-[-0.02em]", sample: "Sign-up guard rejects stale invites" },
  { token: "text-xl", px: "20/28", use: "page title", className: "font-display text-xl font-semibold tracking-[-0.015em]", sample: "My issues" },
  { token: "text-lg", px: "16/24", use: "section title", className: "text-lg font-medium", sample: "Sub-issues" },
  { token: "text-base", px: "14/22", use: "descriptions, docs", className: "text-base", sample: "Agents read the context doc before they start." },
  { token: "text-sm", px: "13/20", use: "UI default", className: "text-sm", sample: "Move to In Review and assign to me" },
  { token: "text-xs", px: "12/16", use: "metadata", className: "text-xs text-muted-foreground", sample: "Updated 3 min ago · via MCP" },
  { token: "text-2xs", px: "11/16", use: "keycaps, counters", className: "text-2xs text-muted-foreground", sample: "12 open · 3 in review" },
];

export function TypeSection() {
  const brand = useDesignBrand();
  return (
    <Section
      id="type"
      title="Typography"
      description="Geist for display, Inter for the UI, Geist Mono for keys, timestamps, shortcuts and code (Q5 ★). 13px is the UI default and 12px is metadata. Two weights do most of the work: 400 and 500, with 600 for display."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[
          { label: "Display", token: "--font-display", family: "Geist", className: "font-display text-2xl font-semibold tracking-[-0.02em]", sample: "Ship the next issue" },
          { label: "UI", token: "--font-body", family: "Inter", className: "font-sans text-2xl", sample: "Ship the next issue" },
          { label: "Mono", token: "--font-mono", family: "Geist Mono", className: "font-mono text-2xl tracking-tight", sample: `${brand.defaultKey}-42 14:03` },
        ].map((face) => (
          <div key={face.label} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-foreground">{face.label}</span>
              <TokenName>{face.token}</TokenName>
            </div>
            <span className={cn(face.className, "text-foreground")}>{face.sample}</span>
            <span className="text-xs text-muted-foreground">{face.family}</span>
          </div>
        ))}
      </div>

      <SubSection title="Scale" hint="size / line-height in px">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {TYPE_SCALE.map((row) => (
            <div key={row.token} className="grid grid-cols-[6.5rem_4rem_1fr] items-center gap-3 px-3 py-2.5 sm:grid-cols-[6.5rem_4rem_8rem_1fr]">
              <TokenName className="text-xs text-foreground">{row.token}</TokenName>
              <span className="font-mono text-2xs text-faint-foreground tabular">{row.px}</span>
              <span className="hidden text-xs text-faint-foreground sm:block">{row.use}</span>
              <span className={cn("min-w-0 truncate text-foreground", row.className)}>{row.sample}</span>
            </div>
          ))}
        </div>
      </SubSection>

      <SubSection title="Mono in context" hint="keys, timestamps, metadata">
        <Specimen className="gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{brand.defaultKey}-128</span>
          <span className="font-mono tabular">2026-10-26 14:03</span>
          <span className="font-mono">{brand.tokenPrefix}x7Kq••••</span>
          <span className="font-mono tabular">0.42s</span>
          <span>
            Created by <span className="text-foreground">Kris</span> <span className="font-mono tabular">3m</span> ago
          </span>
        </Specimen>
      </SubSection>
    </Section>
  );
}

export function LayoutSection() {
  return (
    <Section
      id="layout"
      title="Shape and density"
      description="Small concentric radii, hairline borders and surface steps do the separating. Shadows only appear on overlays. Rows are 32px and controls 28px, so a laptop screen shows a full sprint without scrolling."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SubSection title="Radii" hint="--radius-*">
          <Specimen className="items-end gap-4">
            {[
              ["xs", "3"],
              ["sm", "4"],
              ["md", "5"],
              ["lg", "6"],
              ["xl", "8"],
              ["2xl", "12"],
            ].map(([name, px]) => (
              <div key={name} className="flex flex-col items-center gap-1.5">
                <span
                  className="size-10 border border-border-strong bg-muted"
                  style={{ borderRadius: `var(--radius-${name})` }}
                />
                <span className="font-mono text-2xs text-faint-foreground">
                  {name} · {px}
                </span>
              </div>
            ))}
          </Specimen>
        </SubSection>
        <SubSection title="Elevation" hint="--shadow-raised / --shadow-overlay">
          <Specimen className="gap-6 bg-muted">
            <div className="flex h-14 w-28 items-center justify-center rounded-lg bg-background text-xs text-muted-foreground">
              flat
            </div>
            <div className="flex h-14 w-28 items-center justify-center rounded-lg bg-background text-xs text-muted-foreground shadow-raised">
              raised
            </div>
            <div className="flex h-14 w-28 items-center justify-center rounded-lg bg-popover text-xs text-muted-foreground shadow-overlay">
              overlay
            </div>
          </Specimen>
        </SubSection>
      </div>
      <SubSection title="Density" hint="--row-height, --control-height*, --menu-item-height">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {[
            { token: "--row-height", px: 32, use: "list rows" },
            { token: "--control-height-lg", px: 32, use: "primary actions in dialogs, sign-in" },
            { token: "--control-height", px: 28, use: "buttons, inputs, menu rows, sidebar items" },
            { token: "--control-height-sm", px: 24, use: "inline property pickers, toolbars" },
          ].map((row) => (
            <div key={row.token} className="flex items-center gap-4 px-3 py-2">
              <span
                className="w-24 shrink-0 rounded-sm bg-primary-subtle"
                style={{ height: row.px }}
                aria-hidden
              />
              <TokenName className="w-40 text-xs text-foreground">{row.token}</TokenName>
              <span className="font-mono text-2xs text-faint-foreground tabular">{row.px}px</span>
              <span className="hidden text-xs text-muted-foreground sm:block">{row.use}</span>
            </div>
          ))}
        </div>
      </SubSection>
    </Section>
  );
}
