import { StringScanner } from "strscan-ts"
import * as T from "./types"

////////////////////////////////////////////////////////////////////////

export function parse_row(row_source: string): T.Maybe<T.ParsedRow> {
    const row = new StringScanner(row_source.trim())
    return  legacy_format_row(row) 
         || new_format_row(row) 
         || table_title_row(row)
         || content_row(row)
         || unknown_table_row(row.peek(100))
}

////////////////////////////////////////////////////////////////////////

const FMT_MSG = `
A table should contain two or more rows, each starting
and ending with a pipe character ("|").
`

function parse_fail(msg: string) : false {
    console.error(msg)
    return false
}

function unknown_table_row(row_source: string): false {
    return parse_fail(`Can't decipher table row: ${row_source}\n${FMT_MSG}`)
}


function legacy_format_row(row: StringScanner): T.Maybe<T.LegacyFormatRow> {
    const fmt = row.scan(/\s*\|\s*(:?---+:?\s*\|\s*)+$/)
    if (!fmt)
        return false
    const formats = fmt.split("|").slice(1, -1)

    const new_formats = formats.map((f) => map_legacy(f.trim()))
    return { kind: "legacy_format", content: new_formats }
}

function map_legacy(fmt: string): T.Formats {
    const sc = fmt.startsWith(":")
    const ec = fmt.endsWith(":")
   
    if (sc && ec)
        return ["="]
    if (sc)
        return ["<"]
    if (ec)
        return [">"]
    return [ "=" ]
}

function new_format_row(row: StringScanner): T.Maybe<T.FormatRow> {
    if (!row.check(/\s*\|:/))
        return false

    const formats = []

    while (true) {
        if (row.scan(/\s*\|\s*$/))
            break
        if (!row.scan(/\s*\|:?\s*/))
            return false

        const mods = maybe_formats(row)
        formats.push(mods)
    }

    return { kind: "format", content: formats }
}

function table_title_row(row: StringScanner): T.Maybe<T.CaptionRow> {
    if (!row.scan(/\s*\|!/))
        return false
    const classes = class_formats(row, class_format)
    const caption = cell_content(row)
    return { kind: "caption", content: [{ formats: classes, content: caption }]}
}


function content_row(row: StringScanner): T.Maybe<T.ContentRow> {
    const result: T.ParsedCell[] = []
    let a_cell = cell(row)

    while (a_cell) {
        result.push(a_cell)
        a_cell = cell(row)
    }

    if (result.length == 0)
        return false

    return  { kind: "content", content: result }
}

function cell(row: StringScanner): T.ParsedCell | false {
    // skip past opening
    if (!row.scan(/\s*\|/))
        return false

    // put done if it was the pipe at the end of the line
    if (row.scan(/\s*$/))
      return false 

    const formats = maybe_formats(row)
    row.skip(/\s*/)
    const content = cell_content(row)
    if (!content || content.length == 0)
        return false

    return { formats, content }
}

function cell_content(row: StringScanner): string[] {
    let result = []
    let fragment = cell_fragment(row)

    while (fragment) {
        result.push(fragment)
        fragment = cell_fragment(row)
    }

    // empty cell?
    if (result.length == 0 && row.check(/\|/)) {
        result = [ "" ]
    }

    return result 
}

function cell_fragment(row: StringScanner): string | false {
    return (row.scan(/`[^`]+`/)   ||  // inline code
            row.scan(/\$[^$]+\$/) ||  // inline math
            row.scan(/\\|/)       ||  // escaped pipe
            row.scan(/[^`$|]+/))
}

function maybe_formats(row: StringScanner) {
    const span = span_modifier(row)
    if (span)
        return [ span ]
    else
        return other_modifiers(row)
}

function span_modifier(row: StringScanner): T.Maybe<T.Format> {
    return row.scan(/[{^]/)
}

 
function formats(row: StringScanner, kind: T.FormatScanner): T.Formats {
    const result:T.Formats = []
    let mod: T.Maybe<T.SingleFormat> = kind(row)
    while (mod) {
        let actual: T.Format = mod
        if (row.scan(/(\.\.\.)|…/))
            actual = [ "repeat", mod ]

        result.push(actual)
        mod = kind(row)
    }
    return result
}

function class_formats(row: StringScanner, kind: T.FormatScanner): T.SingleFormat[] {
    const result:T.SingleFormat[] = []
    let mod: T.Maybe<T.SingleFormat> = kind(row)
    while (mod) {
        result.push(mod)
        mod = kind(row)
    }
    return result
}

function other_modifiers(row: StringScanner): T.Formats {
  return formats(row, other_modifier)
}

function other_modifier(row: StringScanner): T.Maybe<T.SingleFormat> {
   return alignment_modifier(row) || class_format(row) || heading_modifier(row)
}

function alignment_modifier(row: StringScanner): T.Maybe<T.SingleFormat> {
    return row.scan(/[<=>]/)
}

function class_format(row: StringScanner): T.Maybe<T.SingleFormat> {
    return row.scan(/\.(?!\d)[-\w]+/)
}

function heading_modifier(row: StringScanner): T.Maybe<T.SingleFormat> {
    return row.scan(/#/)
}

