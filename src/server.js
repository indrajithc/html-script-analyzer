import { serve } from "bun";
import { readFile } from "fs/promises";
import { JSDOM } from "jsdom";

import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 9833;

serve({
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      // Read and parse the HTML file
      const html = await readFile("./index.html", "utf8");
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract <script> tags and wrap them with toggling options
      const scriptTags = Array.from(document.querySelectorAll("script"));
      const scriptListHTML = scriptTags.map((script, idx) => `
        <li>
          <label>
            <input type="checkbox" data-index="${idx}" checked> ${script.src || "Inline Script"}
          </label>
        </li>
      `).join("");

      // Append the toggle interface
      const scriptToggleInterface = `
        <ul>${scriptListHTML}</ul>
        <script>
          document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', async (e) => {
              const index = e.target.getAttribute('data-index');
              await fetch('/toggle?index=' + index, { method: 'POST' });
              location.reload();
            });
          });
        </script>
      `;
      document.body.innerHTML += scriptToggleInterface;

      return new Response(dom.serialize(), { headers: { "Content-Type": "text/html" } });
    } else if (url.pathname === "/toggle") {
      const index = new URLSearchParams(url.search).get("index");
      // Logic to disable or enable script based on index
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
  port,
});
