import { parse_row } from "./parser"
import * as T from "./types"

const LINE_CONTINUATION = /\\\n/

function merge_continuation_lines(table: string): string {
  return table.replace(LINE_CONTINUATION, "")
}

const NEWLINE_PATTERN = /\r?\n/

function split_into_rows(table: string): string[] {
  return table.trim().split(NEWLINE_PATTERN)
}

// ########################################################################

class Format {
  propagate_formats: string[] = []
  alignment: T.Alignment = "="
  span?: string
  css_classes: string[] = []
  heading: boolean = false

  constructor(other?: Format) {
    this.alignment = other?.alignment || "="
    this.span = other?.span
    this.css_classes = (other?.css_classes || [] ).concat([])
    this.heading = !!other?.heading 
  }

  merge(cell_format: T.Formats) {
    const new_format = new Format(this)
    for (let fmt of cell_format) {

      if (fmt instanceof Array) {
        let mod = fmt[0]
        fmt = fmt[1]
        if (mod != "repeat") 
          console.error(`Invalid format modifier: "${mod}"`)
        else
          new_format.propagate_formats.push(fmt)
      }

      switch (fmt) {
        case "<": case "=": case ">":
          new_format.alignment = fmt
        break

        case "^": case "{":
          new_format.span = fmt
        break;

        case "#":
          new_format.heading = true
        break

        default:
          if (fmt.startsWith(".")) {
          new_format.css_classes.push(fmt.slice(1))
        }
        else
          console.error(`Ignoring invalid format ${fmt}`)
        }
      }
      return new_format
    }
}

// ########################################################################

  /**
    * A single cell in the table. All information is accessed via properties.
    * (Only exported to make testiong easier)
  */

  export class Cell {
    /** 
      * If this cell is the first cell in a column of rowspans, the number of
      * spanned rows that follow. (You'll want to add 1 to create a rowspan
      * attribute)
      */
    rowspan_count = 0

    /**
      * If this cell is the first in a number of spanned cells in a row, the
      * number of cells that follow. (Again, add one to create the colspan
      * attribute).
                                      */
    colspan_count = 0

    /**
      * If `true`, do not generate HTML for this cell. This is set
      * on cells that are part of a row or column span.
      */
    hidden = false

    /**
      * The original content of the cell (in Markdown markup). Note that it
      * might be block content.
      */
    content: string

    /**
      * The [[`Format`]] object for this cell.
      */
    format: Format

    /**
      * A spare field that can be used by rendering (for example to pass information
      * between the tokenizer and the renderer in marked)
      */

    data: any

    constructor(raw_cell: T.ParsedCell, base_format: Format, row_format: T.Formats) {
      this.content = raw_cell.content.join("").trim()
      this.format = base_format.merge(row_format.concat(raw_cell.formats))
    }
  }

  const  EMPTY_CELL: T.ParsedCell = { formats: [], content: [] }


  /**
    * A `Row` corresponds to a content row in the resulting table.
    */

  export class Row {

    cells: Cell[] = []

    each_cell(cb: (cell: Cell, i?: number) => void) {
      this.cells.forEach(cb)
    }

    append(cell: Cell) {
      this.cells.push(cell)
    }

    cellAt(n: number) {
      return this.cells[n]
    }

    looks_like_header() {
      return this.cells.every(cell => cell.hidden || cell.format.heading)
    }
  }

  // ########################################################################

  /**
    * Objects of class AST represent a table that has been parsed, and with all the
    * row and cell properties calculated.
    *
    * Table-level information is available as properties of the object.
    *
    * The content rows are available by calling [[`split_out_head`]], which
    * returns a list of rowes in the table header and another list of rows in the
    * body.
    */ 

  export class Ast {

    /** The number of content rows (including header rows) in the table */
      row_count: number

    /** 
      * The number of columns in the table. This value is the maximum of the
      * lengths of all the original Markdown rows (including format rows)
      */
    col_count: number

    /** If present, the table caption. This is whatever follows any classes
      * in the `[!]` row, and so may contain Markdown markup.
      */
    caption?: string

    /**
      * A list of css classes that should be applied to the overall table.
      */
    table_classes: string[] = [ "tableau-table" ]

    /** @internal */

    private default_formats: Format[] = []
    private seen_legacy = false

    /** public only to make testing less painful */
    /* private */ rows: Row[] = []


    constructor(row_count: number, col_count: number) {
      for (let i = 0; i < col_count; i++)
      this.default_formats.push(new Format())
      this.row_count = row_count
      this.col_count = col_count
    }

    each_row(cb: (row: Row, i?: number) => void) {
      this.rows.forEach(cb)
    }

    add_content_row(parsed_row: T.ContentRow) {
      const cells = parsed_row.content
      const row = new Row()
      let row_format: T.Formats = []

      for (let col = 0; col < this.col_count; col++) {
        let raw_cell = (col < cells.length) ? cells[col] : EMPTY_CELL
        let cell = new Cell(raw_cell, this.default_formats[col], row_format)
        row_format = row_format.concat(cell.format.propagate_formats)
        row.append(cell)
      }
      this.rows.push(row)
    }

    add_caption_row(parsed_row: T.CaptionRow) {
      const content = parsed_row.content[0]

      const classes = content.formats
      if (classes)
        this.table_classes = this.table_classes.concat(classes.map(cls => cls.slice(1)))

      const caption = content.content?.join("").trim()
      if (caption.length > 0)
        this.caption = caption
    }

    add_format_row(formats: T.Formats[]) {
      let row_format: T.Formats = []

      for (let col = 0; col < this.col_count; col++) {
        let fmt = (col < formats.length) ? formats[col] : []
        this.default_formats[col] = this.default_formats[col].merge(row_format.concat(fmt))
        row_format = row_format.concat(this.default_formats[col].propagate_formats)
      }
    }

    add_legacy_format_row(formats: T.Formats[]) {
      this.add_format_row(formats)
      if (!this.seen_legacy) {
        this.make_rows_into_heading()
        this.seen_legacy = true
      }
    }

    make_rows_into_heading() {
      for (let row of this.rows)
        for (let cell of row.cells)
          cell.format.heading = true
    }

    merge_spans() {
      this.merge_colspan()
      this.merge_rowspan()
    }

    merge_colspan() {
      for (let row of this.rows) {
        let count = 0
        for (let col_idx = this.col_count-1; col_idx >= 0; col_idx--) {
          let cell = row.cellAt(col_idx)
          if (cell.format.span == "{") {
            count += 1
            cell.hidden = true
          }
          else {
            cell.colspan_count = count
            count = 0
          }
          }
          if (count > 0) {
            console.error("Cannot span horizontally in first column of table")
          }
        }
      }

      merge_rowspan() {
        for (let col_idx = this.col_count-1; col_idx >= 0; col_idx--) {
          let count = 0
          for (let row_idx = this.row_count-1; row_idx >= 0; row_idx--) {
            const cell = this.rows[row_idx].cellAt(col_idx)
            if (cell.format.span == "^") {
              count += 1
              cell.hidden = true
            }
            else {
              cell.rowspan_count = count
              count = 0
            }
          }
          if (count > 0) {
            console.error("Cannot span vertically in top row of table")
          }
        }
      }

      split_out_head(): { head: Row[], body: Row[] } {
        const head: Row[] = []
        const body: Row[] = []
        let possibly_head = true

        for (let row of this.rows) {
          if (possibly_head) {
            if (row.looks_like_header())
              head.push(row)
            else
              possibly_head = false
          }
          if (!possibly_head)
            body.push(row)
        }
        return { head, body }
      }

      //     def to_html(self, parent, parser):
      //         head, body = self.split_out_head()

      //         table = etree.SubElement(parent,
      //                 "table",
      //                 { "class": " ".join(self.table_classes)})

      //         if self.caption:
      //             caption = etree.SubElement(table, "caption")
      //             parser.parseChunk(caption, self.caption)

      //         if head: 
      //             thead = etree.SubElement(table, "thead")
      //             for row in head:
      //                 row.to_html(thead, parser)

      //         if body: 
      //             tbody = etree.SubElement(table, "tbody")
      //             for row in body:
      //                 row.to_html(tbody, parser)

    }

    // ########################################################################

    const TEST_RE = /^\s*\|[^\n]+\|\s*\n\s*\|[^\n]+\|\s*(\n|$)/

      /**
      * Some Markdown parsers ask their plugins to perform a quick and dirty test to see if a 
    * block is something they should handle. If so, the parser then calls the plugin's
      * `run` function to do the actual parse (or to reject the block if the original test was
                                               * optimistic). If you are writing an extension for such a parser, delegate to this
                                                 * function.
                                             *
                                       * @param block The Markdown block to be tested as a string with embedded newlines
                                           */
      export function test(block: string) {
      return TEST_RE.test(block)
    }


    export function to_ast(table: string): T.Maybe<Ast> {
      table = merge_continuation_lines(table)
      const rows = split_into_rows(table)

      const parse_result: T.ParsedRow[] = []

      for (let row of rows) {
        let parsed = parse_row(row)
        if (parsed)
          parse_result.push(parsed)
        else
          return false
      }

      if (parse_result.length == 0)
        return false

      const row_count = parse_result.reduce(
        (count, row) => (row.kind == "content") ? count + 1 : count, 
          0
      )

      const col_count = parse_result.reduce(
        (size, row) => {
          let len = row.content.length
          return (len > size) ? len : size
        },
        0
      )

      const ast = new Ast(row_count, col_count)

      for (let row of parse_result) {
        switch (row.kind) {
          case "format":
            ast.add_format_row(row.content)
          break

          case "legacy_format":
            ast.add_legacy_format_row(row.content)
          break

          case "content":
            ast.add_content_row(row)
          break

          case "caption":
            ast.add_caption_row(row)
          break
        }
      }

      ast.merge_spans()
      return ast
    }
    // def ast_to_html(result, parent, parser):
    //     result.to_html(parent, parser)

