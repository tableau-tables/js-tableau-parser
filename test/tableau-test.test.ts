import * as tableau from "../src/tableau"

function test_test(name: string, lines: string[], sense=true) {
  const match = sense ? "toBeTruthy" : "toBeFalsy"
  test(name, () => expect(tableau.test(lines.join("\n")))[match]())
}
test_test(
  "looks like table",
  [
    "| a | b | c |",
    "| d | e | f |",
    "| g | h | i |",
  ])

  test_test(
    "just_two_lines", 
    [
      "| a | b | c |",
      "| d | e | f |",
    ])

    test_test(
      "but_not_one_line", 
      [
        "| a | b | c |",
      ],
      false)

      test_test(
        "missing_opening_bar", 
        [
          "| a | b | c |",
          "  d | e | f |",
          "| g | h | i |",
        ],
        false)

test_test(
          "missing_closing_bar", 
          [
            "| a | b | c  ",
            "| d | e | f |",
            "| g | h | i |",
          ],
          false)

