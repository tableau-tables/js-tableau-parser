import { to_ast, Ast, Cell } from "../src/tableau"
// import * as T from "../src/types"

const DEFAULT_FORMAT = {
  alignment: "=",
    span: undefined,
  heading: false,
  css_classes: [],
}

interface MockAst {
  rows: any[][]
}

class MockCell {
  rowspan_count = 0
  colspan_count = 0
  hidden = false

  constructor(public content: string, public formats = {}) {

  }
}
function c(content: string, formats: {} = {}): MockCell {
  return new MockCell(content, formats)
}

function mast(rows: any[][], table_options: {} = {}): MockAst {
  return Object.assign({
    rows: rows,
  }, table_options)
}

function assertResult(actual: Ast, expected: MockAst) {
  expect(actual.rows.length).toEqual(expected.rows.length)
  for (let i = 0; i < actual.rows.length; i++) {
    let got = actual.rows[i].cells
    let wanted = expected.rows[i]
    expect(got.length).toEqual(wanted.length)
    for (let j = 0; j < got.length; j++)
    assertCell(got[j], wanted[j])
  }
}

function assertCell(actual: Cell, expected: MockCell) {
  let format = Object.assign({}, DEFAULT_FORMAT, expected.formats)
  // console.log("-===================================")
  // console.log("expected", format["css_classes"], expected.content)
  // console.log("actual", actual.format["css_classes"], actual.content)
  expect(actual.content).toEqual(expected.content)
  expect(actual.format.alignment).toEqual(format["alignment"])
  expect(actual.format.span).toEqual(format["span"])
  expect(actual.format.heading).toEqual(format["heading"])
  expect(actual.format.css_classes).toEqual(format["css_classes"])
}


function test_parse(title: string, table: string[], expected: MockAst) {
  test(title, () => {
    const result = to_ast(table.join("\n"))
    expect(result).toBeTruthy()
    if(result) {
      assertResult(result, expected)
    }
  })
}
// DEFAULT_FORMAT = {
//             'alignment': "=",
//             "span": None,
//             "heading": False,
//             "css_classes": [],
//         }

// class TestTableauParse(unittest.TestCase):




test_parse(
  "simple_table",
  [
    "| a | b |",
    "| d | e |",
  ],
  mast([ 
    [ c("a"), c("b") ],
    [ c("d"), c("e") ],
  ])
)

test_parse(
  "table_pads_column_length",
  [
    "| a | b |",
    "| d | e | f |",
    "| g |",
  ],
  mast([ 
    [ c("a"), c("b"), c("") ],
    [ c("d"), c("e"), c("f") ],
    [ c("g"), c(""), c("") ],
  ])
)

test_parse(
  "table_empty_columns",
  [
    "| a |   |",
    "|   | e | f |",
    "| g |",
  ],
  mast([ 
    [ c("a"), c(""),  c("")  ],
    [ c(""),  c("e"), c("f") ],
    [ c("g"), c(""),  c("")  ],
  ])
)

test_parse(
  "format_row_included_in_padding",
  [
    "| a | b |",
    "|:< |:= |:> |",
      "| g |",
  ],
  mast([ 
    [ c("a"), c("b"), c("")  ],
    [ c("g", {"alignment": "<"}), c(""),  c("", {"alignment": ">"})  ],
  ])
)

test_parse(
  "format_row_applies_alignment_to_subsequent_rows",
  [
    "| a | b |",
    "|:< |:= |:> |",
      "| c | e | f | g |",
    "| h |",
  ],
  mast([ 
    [ c("a"), c("b"), c(""), c("") ],
    [ c("c", {"alignment": "<"}), c("e"),  c("f", {"alignment": ">"}), c("g")  ],
    [ c("h", { "alignment": "<"}), c(""),c("", {"alignment": ">"}),  c(""), ]
  ])
)

const right = { alignment: ">"}
const left = { alignment: "<"}

test_parse(
  "column_repeat_format_applies_to_subsequent_columns",
  [
    "| a |>… b | c | d |",
    "| h |",
  ],

  mast([ 
    [ c("a"), c("b", right), c("c", right), c("d", right) ],
    [ c("h"), c(""), c(""), c("")    ]
  ])
)

test_parse(
  "column_repeat_can_be_overridden",
  [
    "| a |>… b | c |< d |",
    "| h |",
  ],
  mast([ 
    [ c("a"), c("b", right), c("c", right), c("d", left) ],
    [ c("h"), c(""), c(""), c("")    ]
  ])
)

test_parse(
  "column_repeat_works_in_format_lines",
  [
    "|:  |>…  |   |<  |",
    "| a | b  | c | d |",
    "| h |",
  ],
  mast([ 
    [ c("a"), c("b", right), c("c", right), c("d", left) ],
    [ c("h"), c("", right),  c("", right),  c("", left) ],
  ])
)

test_parse(
  "legacy_format_row_applies_alignment_to_subsequent_rows",
  [
    "|:--- |:---: | ---: |",
    "| c | e | f | g |",
    "| h |",
  ],
  mast([ 
    [ c("c", {"alignment": "<"}), c("e"),  c("f", {"alignment": ">"}), c("g")  ],
    [ c("h", { "alignment": "<"}), c(""),c("", {"alignment": ">"}),  c(""), ]
  ])
)

test_parse(
  "legacy_format_makes_preceding_row_a_header",
  [
    "| a | b |",
    "|:--- |:---: | ---: |",
    "| c | e | f | g |",
    "| h |",
  ],
  mast([ 
    [ c("a", {"heading": true}), c("b", {"heading": true}), c("", {"heading": true}), c("", {"heading": true}) ],
    [ c("c", {"alignment": "<"}), c("e"),  c("f", {"alignment": ">"}), c("g")  ],
    [ c("h", { "alignment": "<"}), c(""),c("", {"alignment": ">"}),  c(""), ]
  ])
)

test_parse(
  "legacy_format_makes_preceding_rows_a_header",
  [
    "| a | b |",
    "| x | y |",
    "|:--- |:---: |",
    "| c | e |",
    "| h |",
  ],
  mast([ 
    [ c("a", {"heading": true}), c("b", {"heading": true}) ],
    [ c("x", {"heading": true}), c("y", {"heading": true}) ],
    [ c("c", {"alignment": "<"}), c("e") ],
    [ c("h", { "alignment": "<"}), c("") ],
  ])
)


test_parse(
  "header_row",
  [
    "|# a |# b |",
    "| d | e |",
  ],
  mast([ 
    [ c("a", {"heading": true}), c("b", {"heading": true}) ],
    [ c("d"), c("e") ],
  ])
)

test_parse(
  "headers_anywhere",
  [
    "|# a | b |",
    "| d |# e |",
  ],
  mast([ 
    [ c("a", {"heading": true}), c("b") ],
    [ c("d"), c("e", {"heading": true}) ],
  ])
)


test_parse(
  "headers_propagate",
  [
    "|:# |   |",
    "| a | b |",
    "| d | e |",
  ],
  mast([ 
    [ c("a", {"heading": true}), c("b") ],
    [ c("d", {"heading": true}), c("e") ],
  ])
)

test_parse(
  "single_rowspan",
  [
    "| a | b |",
    "|^  | e |",
  ],
  mast([ 
    [ c("a"), c("b") ],
    [ c("", { "span": "^"}), c("e") ],
  ])
)

test_parse(
  "single_colspan",
  [
    "| a | b |",
    "| d |{e |",
  ],
  mast([ 
    [ c("a"), c("b") ],
    [ c("d"), c("e", { "span": "{"})]
  ])
)

test_parse(
  "class_names_as_formats",
  [
    "|.c1 a | b |",
    "| d |.c2.c3> e |",
  ],
  mast([ 
    [ c("a", { "css_classes": [ "c1" ]}), c("b") ],
    [ c("d"), c("e", { "alignment": ">", "css_classes": [ "c2", "c3" ]})]
  ])
)

test_parse(
  "caption",
  [
    "|!.c1.c2 Caption, My Caption |",
    "| a | b |",
    "| d |e |",
  ],
  mast([ [c("a"), c("b")], [c("d"), c("e")]],
       { caption: "Caption, My Caption",
         table_classes: [ "tableau-table", "c1", "c2" ],
       })
)

test_parse(
  "no_header_but_format",
  [
    "|:---:|:---:|",
    "| a | b |",
    "| d | e |",
  ],
  mast([ 
    [ c("a"), c("b") ],
    [ c("d"), c("e") ],
  ])
)
