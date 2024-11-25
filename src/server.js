import { serve } from "bun";
import { readFile } from "fs/promises";
import { JSDOM } from "jsdom";
import fs from "fs";

import dotenv from "dotenv";
import path from "path";
dotenv.config();

const rootDirectory = process.cwd();

const port = process.env.PORT || 9833;

const contentDirectory = path.join(rootDirectory, "data");

if (!fs.existsSync(contentDirectory)) {
  fs.mkdirSync(contentDirectory);
}

const handleTargetRequest = async (req) => {
  const method = req.method;

  if (method === "POST") {
    const body = await req.json();
    let finalContent = body.content;
    if (body.url) {
      try {
        const uri = new URL(body.url);
        // download the content from the url and save in data folder
        const response = await fetch(uri);
        const content = await response.text();
        console.log("content", content);
        finalContent = content;
      } catch (error) {
        console.error("Failed to download content", error);
        return new Response("Failed to download content", { status: 500 });
      }
    }

    try {
      const fileName = `${body.name}_${Date.now()}.html`;
      const filePath = path.join(contentDirectory, fileName);
      console.info("Saving content to", filePath);
      const response = fs.writeFileSync(filePath, finalContent);
      console.log("response", response);
    } catch (error) {
      console.error("Failed to save content", error);
      return new Response("Failed to save content", { status: 500 });
    }

    console.log("body", body);
    return new Response("POST request received", { status: 200 });
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Html</title>
    </head>
    <body>
      <h1>Html</h1>
      <form id="uploader" method="POST">
      <table>
      <tr>
      <td>Name</td>
      <td><input type="text" name="name" placeholder="Enter name" /></td>
      </tr>
      <tr>
      <td>Url</td>
      <td><input type="text" name="url" placeholder="Enter url" /></td>
      </tr>
      <tr>
      <td>Content</td>
      <td><textarea name="content" placeholder="Enter html content"></textarea></td>
      </tr>
      <tr>
      <td></td>
      <td><button type="submit">Submit</button></td>
      </tr>
      </table> 
      </form>
      <script>
      const form = document.getElementById("uploader");
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const url = formData.get("url");
        const content = formData.get("content");
        const name = formData.get("name");
        const response = await fetch("/target", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name, url, content })
        });
          if(response.ok) {
          form.reset();
        } else {
          alert("Failed to upload");
        }
      });
      </script>
    </body>
    </html>
  `;

  return new Response(htmlContent, {
    headers: { "Content-Type": "text/html" },
  });
};

serve({
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname?.startsWith("/target")) {
      return handleTargetRequest(req);
    }

    // if (url.pathname === "/") {
    //   // Read and parse the HTML file
    //   const html = await readFile("./index.html", "utf8");
    //   const dom = new JSDOM(html);
    //   const document = dom.window.document;

    //   // Extract <script> tags and wrap them with toggling options
    //   const scriptTags = Array.from(document.querySelectorAll("script"));
    //   const scriptListHTML = scriptTags.map((script, idx) => `
    //     <li>
    //       <label>
    //         <input type="checkbox" data-index="${idx}" checked> ${script.src || "Inline Script"}
    //       </label>
    //     </li>
    //   `).join("");

    //   // Append the toggle interface
    //   const scriptToggleInterface = `
    //     <ul>${scriptListHTML}</ul>
    //     <script>
    //       document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    //         checkbox.addEventListener('change', async (e) => {
    //           const index = e.target.getAttribute('data-index');
    //           await fetch('/toggle?index=' + index, { method: 'POST' });
    //           location.reload();
    //         });
    //       });
    //     </script>
    //   `;
    //   document.body.innerHTML += scriptToggleInterface;

    //   return new Response(dom.serialize(), { headers: { "Content-Type": "text/html" } });
    // } else if (url.pathname === "/toggle") {
    //   const index = new URLSearchParams(url.search).get("index");
    //   // Logic to disable or enable script based on index
    //   return new Response("OK");
    // }

    return new Response("Not Found", { status: 404 });
  },
  port,
});
