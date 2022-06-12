# Extended Table Syntax for Markdown

[Tableau Tables](https://tableau-tables.github.io) gives you way more control 
over the tables you create in Markdown documents. `tableau-marked` is the version of Tableau 
for the Python Markdown processor.

#### Headers

* Headerless tables
* Multiline headers
* Multiple separate headers
* Headers in columns and rows
* Captions

#### Layout

* Layout uses CSS styles and not inline attributes (making it easier to
  change the style of a whole document)
* Per cell alignment and CSS classes
* Default attributes, both down columns and across rows
* Table-wide classes
* Row and column span
* Continuation lines

Here are [some samples](https://tableau-tables.github.io/samples/).

This repository contains a JavaScript library that handles most of
the work of transforming a table description into HTML. However, by
itself, it is not a Markdown processor plugin.

Instead, it is a library used by folks who want to _write_ a plugin for their favorite
Markdown processor.

If you're looking for an existing plugin, have a look at [this list](https://tableau-tables.github.io#if-you-want-to-use-tableau-tables).

### Writing a Plugin

There's a [guide](https://tableau-tables.github.io/write_javascript_plugin/).


