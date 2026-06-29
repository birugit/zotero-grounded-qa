# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/).

> Version note: this release jumps to **4.0.0**. The repository was forked from
> the upstream Zotero plugin template, whose git history already carried version
> tags up to `v3.1.0`. Releasing above those avoids tag collisions; the number
> is not meaningful beyond "newer than everything before it."

## [4.0.0] — 2026-06-28

First release as **Lattice** (renamed from **Grounded Q&A**), reflecting an
expanded scope from an AI Q&A tool to a cross-paper annotation and idea
platform. Functionally this is the "1.1.0" milestone; see the version note above
for why it ships as 4.0.0.

### Added

- **Cross-paper annotation browser** (Tools → All Annotations): a single
  library-wide window listing every annotation, with live filtering by colour,
  tag, keyword, and type, and windowed rendering for large libraries.
- **Export with citations**: copy the filtered set as Markdown or HTML, or save
  it as a standalone Zotero note. Each source is cited once using the user's
  Zotero citation style, with its highlights/notes beneath.
- **Citavi-style idea layer**: promote annotations into first-class "idea" notes
  (tagged `★idea`) that are searchable and taggable in Zotero, can be tagged in
  place, linked idea-to-idea, and linked back to their source — presented as a
  tab inside the All Annotations window and via Tools → Idea Layer (Citavi).
- **Save Q&A answers as annotations**: single-paper and multi-paper Q&A answers
  can be saved as page-anchored note annotations, so AI-surfaced insights flow
  into the annotation browser and idea layer.
- Live annotation index kept fresh via Zotero's Notifier.

### Changed

- Plugin display name is now **Lattice**; settings pane and notifications
  updated accordingly.
- Multi-paper Q&A prompt hardened to reliably emit `[Paper N, Page M]`
  citations, and citation parsing made tolerant of formatting variation.

### Fixed

- Multi-paper "Save as annotations" failing with `'key' not provided in JSON`
  (annotation creation now generates a valid object key).
- Dialog buttons rendering without visible labels (forced HTML namespace and
  disabled native button theming).
- Idea linking control not responding in dialog windows (replaced the
  `<select>`/native prompt with an inline button picker; delete uses an inline
  two-step confirm).

### Known limitations

- Deep links and indexing assume the user library (group-library support
  pending).
- Large-library performance not yet stress-tested.
- Idea-layer flows (link/open-source/tag editing) are implemented but not yet
  fully verified end-to-end.

## [1.0.x] — Grounded Q&A (pre-Lattice)

- Single-paper and multi-paper grounded Q&A with `[Page N]` / `[Paper N, Page M]`
  clickable citations.
- Multi-provider support: Anthropic, OpenAI, Ollama, DeepSeek, Grok.
