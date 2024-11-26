import path from "path";
import config, { staticHeaders } from "../config";
import fs from "fs";
import { JSDOM } from "jsdom";
import { get } from "http";

const { contentDirectory, contentConfigDirectory } = config;

const processFilename = "index.html";
const scriptMetadataFilename = "script-metadata.json";

const getUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

const getSpyJs = () => {
  return new Response(
    `
    console.log('Spy JS loaded');
    `,
    {
      headers: { "Content-Type": "text/javascript" },
    }
  );
};

const doFirstTimeActivity = (sourceFilePath, destinationDirectory) => {
  const filePath = path.join(destinationDirectory, processFilename);

  const content = fs.readFileSync(sourceFilePath, "utf-8");

  const dom = new JSDOM(content);
  const { document } = dom.window;

  // list all the script tags
  const scriptTags = document.querySelectorAll("script");

  const scriptList = [];

  scriptTags.forEach((scriptTag) => {
    const src = scriptTag.getAttribute("src");
    if (!scriptTag.id) {
      scriptTag.id = getUniqueId();
    }
    scriptList.push({
      id: scriptTag.id,
      src: src,
      enabled: true,
      content: scriptTag.innerHTML,
    });
  });

  try {
    fs.writeFileSync(
      path.join(destinationDirectory, scriptMetadataFilename),
      JSON.stringify(scriptList)
    );
  } catch (error) {
    console.error("Failed to save script metadata", error);
  }

  fs.writeFileSync(filePath, dom.serialize());
  return filePath;
};

export const handleContentRequest = async (req) => {
  const { pathname, searchParams } = new URL(req.url);

  if (pathname === "/content/spy.js") {
    return getSpyJs();
  }

  const referer = req.headers.get("Referer");

  const fileName = pathname.split("/").pop();
  const filePath = path.join(contentDirectory, fileName);

  if (!fs.existsSync(filePath)) {
    return new Response("File not found", { status: 404 });
  }

  const processingDirectory = path.join(contentConfigDirectory, fileName);

  if (!fs.existsSync(processingDirectory)) {
    fs.mkdirSync(processingDirectory);
  }

  const processingFilePath = path.join(processingDirectory, processFilename);

  if (!fs.existsSync(processingFilePath)) {
    await doFirstTimeActivity(filePath, processingDirectory);
  }

  if (referer) {
    const content = fs.readFileSync(processingFilePath, "utf-8");

    const dom = new JSDOM(content);
    const { document } = dom.window;

    document.body.appendChild(
      document.createElement("script")
    ).src = `/content/spy.js`;

    const html = document.documentElement.outerHTML;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  const scriptMetadataPath = path.join(
    processingDirectory,
    scriptMetadataFilename
  );
  let scriptMetadata = null;
  try {
    scriptMetadata = JSON.parse(fs.readFileSync(scriptMetadataPath, "utf-8"));
  } catch (error) {
    console.error("Failed to read script metadata", error);
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
          <div class="col-12 col-md-6 col-lg-5">
            <div class="card h-100">
              <div class="card-header">
                <h3>${fileName}</h3>
              </div>
              <div class="card-body"> 
              <button onclick="refreshIframe()" class="btn btn-primary w-100 btn-lg">Refresh Site</button>
              
              ${
                Array.isArray(scriptMetadata)
                  ? `
                <div class="overflow-y-auto overflow-x-hidden" style="height: calc(100vh - 150px);">
                  <div class="accordion" id="accordionExample">
              ${scriptMetadata
                .map(
                  (script, index) => `
                  <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                      <div class="card card-body p-1 d-flex flex-column " type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="true" aria-controls="collapse${index}">
                        <span class="fs-6 mb-2">${script.id}</span> 
                        <small class="text-wrap text-muted fs-5">${
                          script.src || "Inline script"
                        }</small>
                      </div>
                    </h2> 
                    ${
                      script.content
                        ? `
                    <div id="collapse${index}" class="accordion-collapse collapse" aria-labelledby="heading${index}" data-bs-parent="#accordionExample">
                      <div class="accordion-body p-0">
                      <textarea class="form-control w-100" style="background-color: #f8f9fa;" 
                      rows="${
                        ((script.content?.match(/\n/g) || []).length || 0) + 3
                      }" readonly
                      >${script.content}</textarea>
                      </div>
                    </div>
                    `
                        : ""
                    }
                  </div>`
                )
                .join("")}
              </div>
              </div>
              
              `
                  : '<p class="text-muted text-center mt-4">No scripts found</p>'
              }
              
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
       <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
    </body>
  </html>
  `,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
};
