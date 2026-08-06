# Pending Release Notes

This file accumulates release notes for the next unreleased version. PRs that add user-visible behavior should append a bullet to the relevant section here. Versioned files (`X.Y.Z.md`) are owned by the release skill — never create them in feature commits.

## Features

## Improvements

## Bug Fixes

- **OpenAI-compatible streams preserve chunks with empty tool-call arrays** — Custom endpoints that include `tool_calls: []` on ordinary content and terminal chunks no longer lose those chunks in the network interceptor, preventing valid responses from failing with `Stream ended without finish_reason`. Fixes [#995](https://github.com/craft-ai-agents/craft-agents-oss/issues/995).

## Breaking Changes

- Fixed Chinese IME first-character input conflicting with English auto-capitalisation. On some macOS/Electron builds the native `input` event fires before `compositionstart`, causing the auto-capitalise logic to capitalise the first pinyin letter and corrupt the IME composition session.

- Fixed IME composition text being invisible and placeholder hints overlaying the input during the entire composition phase. `showPlaceholder` was computed from React state (`safeValue`) which stays `''` while `onChange` is blocked during composition, making the preedit text transparent and keeping the rotating placeholder overlay visible.

- **New sessions respect excluded filters** — Creating a session while status, label, or project exclusions are active now ignores those exclusions and uses workspace defaults unless exactly one included filter is selected. [#970](https://github.com/craft-ai-agents/craft-agents-oss/issues/970) · `6a3ba29`
