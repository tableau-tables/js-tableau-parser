import { Ast, Cell, Row } from "./tableau"

type Result = any  // recursive type blows up tsc
type Attrs = {
  [index: string]: string | string[]
}

export function ast_to_html(ast: Ast): string {
  return render_table(ast).flat(Infinity).join("")
}


function render_table(table: Ast) {
  const { head, body } = table.split_out_head()
  return tag("table", { class: table.table_classes.join(" ") }, () => {
    return [
      thead(head),
      tbody(body),
      caption(table.caption),
    ]
  })
}

function thead(head: Row[]) {
  if (head.length == 0)
    return []
  return tag("tbody", {}, () => rows(head))
}

function tbody(body: Row[]) {
  if (body.length == 0)
    return []
  return tag("tbody", {}, () => rows(body))
}

function caption(caption?: string): Result {
  if (!caption || caption.length == 0)
    return []
  return tag("caption", {}, () => [caption])
}

type ContentFunction = () => string[]
const NO_CONTENT:ContentFunction = () => []

function rows(row_list: Row[]) {
  return row_list.map(one_row)
}

function one_row(row: Row) {
  return tag("tr", {}, () => row.cells.map(render_cell))
}


type CellAttrs = {
  class?: string
  rowspan?: string
  colspan?: string
}

const ALIGNMENT_CLASS = {
  "<": "a-l",
  "=": "a-c",
  ">": "a-r",
}


function render_cell(cell: Cell) {
  const tag_name = cell.format.heading ? "th" : "td"
  return tag(tag_name, attrs_of(cell), () => [ cell.content ])
}

function attrs_of(cell: Cell): CellAttrs {
  const fmt = cell.format
  const result: CellAttrs = {}

  if (cell.rowspan_count > 0)
    result.rowspan = cell.rowspan_count.toString()

  if (cell.colspan_count > 0)
    result.colspan = cell.colspan_count.toString()

  const classes = fmt.css_classes.concat([ ALIGNMENT_CLASS[fmt.alignment] ])

  result.class = classes.join(" ")

  return result
}

function tag(name: string, attrs: Attrs, content=NO_CONTENT): Result {
  return [
    `<${name} `, expand_attrs(attrs), `>`, 
      content(),
    `</${name}>`
  ]
}

function expand_attrs(attrs: Attrs): Result {
  return Object.keys(attrs).map((key) => `${key}="${attrs[key].toString()}"`)
}
