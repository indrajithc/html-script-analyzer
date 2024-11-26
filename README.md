# HTML Script Analyzer

**HTML Script Analyzer** is a lightweight package designed to analyze HTML pages, detect and track the loading of `<script>` tags, and monitor performance. This tool is ideal for debugging and optimizing HTML content.

## Features

- Tracks the loading times of all `<script>` tags.
- Injects a loading indicator for enhanced user feedback during page/script loading.
- Provides detailed logs for `<script>` load events.

## Installation

Install the package using npm:

```bash
npm install html-script-analyzer
```


Or add it directly to your project:

```bash
<script src="https://cdn.example.com/html-script-analyzer.js"></script>
```


## Usage

### Node.js Integration

You can use this package in a Node.js server to serve HTML with script tracking enabled.

```javascript
const express = require('express');
const app = express();
const { analyzeHTMLScripts } = require('html-script-analyzer');

app.get('/', (req, res) => {
  const html = `
    <html>
    <head>
      <title>HTML Script Analyzer</title>
    </head>
    <body>
      <script src="example1.js"></script>
      <script src="example2.js"></script>
    </body>
    </html>
  `;
  res.send(analyzeHTMLScripts(html));
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
```


### What It Does
- Automatically wraps your HTML to track `<script>` load events.
- Logs script load performance in the browser console.

### Standalone HTML Example

Add this script directly to your HTML page:

```html
<script src="html-script-analyzer.js"></script>
```


The analyzer will automatically:
- Detect all `<script>` tags in the HTML.
- Log their load timings in the browser console.
- Display a loading indicator for better feedback during script loading.

## API

### `analyzeHTMLScripts(html)`
- **Description**: Wraps your HTML content with the necessary tracking logic.
- **Parameters**: 
  - `html` (string): The HTML content to analyze.
- **Returns**: The modified HTML content.

## Example Output

In the browser console:

```plaintext
Script Loaded: example1.js - 102ms
Script Loaded: example2.js - 134ms
```


## License

This project is licensed under a personal license. For inquiries about usage, redistribution, or modifications, please contact the author directly.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on GitHub.
