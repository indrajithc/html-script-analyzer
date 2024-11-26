import path from "path";
import config, { staticHeaders } from "../config";
import fs from "fs";
import { JSDOM } from "jsdom";

const { contentDirectory, contentConfigDirectory } = config;

export const handleContentRequest = async (req) => {
  const { pathname, searchParams } = new URL(req.url);
  const referer = req.headers.get("Referer");

  const fileName = pathname.split("/").pop();
  const filePath = path.join(contentDirectory, fileName);

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  if (referer) {
    const content = fs.readFileSync(filePath, "utf-8");

    const dom = new JSDOM(content);
    const { document } = dom.window;

    const html = document.documentElement.outerHTML;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(
    `
      <html>
    <head>
      <title>Content</title>
      ${staticHeaders}
      <style>
        html,
        body {
          height: 100%; /* Ensures the body and html take full viewport height */
          margin: 0;
          overflow: hidden; /* Prevent scrolling */
        }
  
        iframe {
          height: 100%; /* Ensures the iframe stretches */
        }
  
        .spinner-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          background-color: #f8f9fa; /* Optional: Light background during loading */
        }
  
        .spinner-container.hidden {
          display: none; /* Hide the spinner once iframe is loaded */
        }
      </style>
      <script>
        function refreshIframe() {
          const iframe = document.getElementById('contentIframe');
          const spinner = document.getElementById('spinnerContainer');
          iframe.style.display = 'none'; // Hide iframe while loading
          spinner.classList.remove('hidden'); // Show spinner
          iframe.src = iframe.src; // Reload iframe
        }
  
        function onIframeLoad() {
          const iframe = document.getElementById('contentIframe');
          const spinner = document.getElementById('spinnerContainer');
          spinner.classList.add('hidden'); // Hide spinner when iframe finishes loading
          iframe.style.display = 'block'; // Show iframe
        }
      </script>
    </head>
    <body>
      <div class="container-fluid py-2 h-100">
        <div class="row h-100">
          <div class="col-12 col-md-6 col-lg-4 col-xl-3">
            <div class="card h-100">
              <div class="card-header">
                <h3>${fileName}</h3>
              </div>
              <div class="card-body">
                 <button onclick="refreshIframe()" class="btn btn-primary w-100 btn-lg">Refresh Site</button>
              </div>
            </div>
          </div>
          <div class="col h-100 position-relative">
            <div id="spinnerContainer" class="spinner-container">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
            <iframe
              id="contentIframe"
              src="${pathname}"
              class="w-100 h-100 mb-2"
              style="border: none; display: none;" 
              onload="onIframeLoad()"
            ></iframe>
          </div>
        </div>
      </div>
    </body>
  </html>
  `,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
};
