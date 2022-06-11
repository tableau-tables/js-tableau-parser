import { StringScanner } from "strscan-ts"

export type Maybe<T> = false | T

export type LegacyFormatRow = { kind: "legacy_format", content: Formats[] }
export type FormatRow       = { kind: "format",        content: Formats[] }
export type ContentRow      = { kind: "content",       content: ParsedCell[]   }
export type CaptionRow      = { kind: "caption",       content: [ ParsedCaption ] }

export type ParsedRow 
  = LegacyFormatRow
  | FormatRow
  | ContentRow
  | CaptionRow

export interface ParsedCell {
  formats:  Formats,
  content:  string[]
}

export interface ParsedCaption {
  formats:  SingleFormat[],
  content:  string[]
}

export type FormatScanner = (row: StringScanner) => Maybe<SingleFormat>
export type SingleFormat  = string

export type RepeatedFormat = [ "repeat", SingleFormat ]
export type Format = SingleFormat | RepeatedFormat
export type Formats = Format[]

export type Alignment = "<" | "=" | ">"
