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

  if (pathname === "/content/toggle" && req.method === "POST") {
    try {
      const body = await req.json();
      const { action, targets, src } = body;

      const fileName = src.split("/").pop();
      const filePath = path.join(contentConfigDirectory, fileName);

      if (!fs.existsSync(filePath)) {
        return new Response("File not found", { status: 404 });
      }

      const scriptMetadataPath = path.join(
        contentConfigDirectory,
        fileName,
        scriptMetadataFilename
      );

      let scriptMetadata = null;
      try {
        scriptMetadata = JSON.parse(
          fs.readFileSync(scriptMetadataPath, "utf-8")
        );
      } catch (error) {
        console.error("Failed to read script metadata", error);
      }

      const updatedScriptMetadata = scriptMetadata.map((script) => {
        if (targets?.includes(script.id) || targets?.length === 0) {
          script.enabled = action;
        }
        return script;
      });

      try {
        fs.writeFileSync(
          scriptMetadataPath,
          JSON.stringify(updatedScriptMetadata)
        );
      } catch (error) {
        console.error("Failed to save script metadata", error);
      }

      return new Response(JSON.stringify({ success: true, ...body }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {}

    return new Response(
      JSON.stringify({ success: false, message: "Failed to toggle script" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
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

  if (referer || pathname.startsWith("/content/html/")) {
    const content = fs.readFileSync(processingFilePath, "utf-8");

    const dom = new JSDOM(content);
    const { document } = dom.window;

    try {
      const scriptMetadataPath = path.join(
        contentConfigDirectory,
        fileName,
        scriptMetadataFilename
      );

      let scriptMetadata = JSON.parse(
        fs.readFileSync(scriptMetadataPath, "utf-8")
      );

      scriptMetadata.forEach((script) => {
        if (!script.enabled) {
          const scriptTag = document.getElementById(script.id);
          scriptTag.remove();
        }
      });
    } catch (error) {}

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
      window.serverScriptIds = ${
        JSON.stringify(scriptMetadata?.map((script) => script.id)) || "[]"
      }
        function refreshIframe() {
          const iframe = document.getElementById('contentIframe');
          const spinner = document.getElementById('spinnerContainer');
          iframe.style.display = 'none'; // Hide iframe while loading
          spinner.classList.remove('hidden'); // Show spinner
          iframe.src = iframe.src; // Reload iframe
          document.getElementById('cf-load-scripts').classList.add('d-none');
        }
  
        function onIframeLoad() {
          const iframe = document.getElementById('contentIframe');
          const spinner = document.getElementById('spinnerContainer');
          spinner.classList.add('hidden'); // Hide spinner when iframe finishes loading
          iframe.style.display = 'block'; // Show iframe
          document.getElementById('cf-load-scripts').classList.remove('d-none');
        }

        function loadScripts() {
          const iframe = document.getElementById('contentIframe');
          const newScriptContainer = document.getElementById('accordionNewScripts');

          if(iframe.contentWindow) {
          newScriptContainer.innerHTML = '';
          let count = 0;
            iframe.contentWindow.document.querySelectorAll('script').forEach((script) => {
              const id = script.id;

              if(id && serverScriptIds.includes(id) || script.src.includes('spy.js')) {
                return;
              }
                count++;

              const src = script.src;
              const content = script.innerHTML;

              console.log('Script found', id, src, content);  


               const accordionItem = document.createElement('div');
              accordionItem.className = 'accordion-item';
              accordionItem.innerHTML = \` 
                    <h2 class="accordion-header" id="gh-heading\${count}">
                      <div class="card card-body  p-1" type="button" data-bs-toggle="collapse" data-bs-target="#gh-collapse\${count}" aria-expanded="true" aria-controls="collapse2">
                        <div class="d-flex">
                        <div class="d-flex flex-column flex-grow-1"> 
                          <span class="fs-6 mb-2">[ \${count}] \${id}</span>
                <small class="text-break text-muted fs-5">\${src || 'Inline script'}</small>
                
                         </div>
                         <div>
                         </div>
                        </div>
                      </div>
                    </h2> 
                    
                    <div id="gh-collapse\${count}" class="accordion-collapse collapse" aria-labelledby="heading2" data-bs-parent="#serverScriptsContainer">
                      <div class="accordion-body p-0">
                      <textarea class="form-control w-100" style="background-color: #f8f9fa;" rows="\${((content.match(/\\n/g) || []).length || 0) + 3}" readonly>\${content}</textarea>
                      </div>
                    </div>
                     
              \`;

 
              newScriptContainer.appendChild(accordionItem);
            });

            if(count === 0) {
              newScriptContainer.innerHTML = '<p class="text-muted text-center mt-4">No new scripts found</p>';
            }
          }

        }


        async function handleBackendToggle(targetIds, action) {
          const response = await fetch("/content/toggle", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ action, targets: targetIds , src: "${pathname}"})
          });

          if(response.ok) {
            try {
              const data = await response.json();
              console.log('Script toggled', data);
              const action = data.action;
              const targetIds = data.targets;
              if(Array.isArray(targetIds)) {
              if(targetIds.length === 0) {
                const checkboxes = document.querySelectorAll('.toggle-checkbox');
                checkboxes.forEach((checkbox) => {
                  checkbox.checked = action;
                });
                } else  {
                  targetIds?.forEach((targetId) => {
                    const targetCheckbox = document.getElementById('script' + targetId);
                    targetCheckbox.checked = action;
                  });
                }
              }
            } catch(error) {
              console.error('Failed to toggle script', error); 
            }
          }
        }

        function checkAll() {
          const serverScriptsContainer = document.getElementById('serverScriptsContainer');
          const checkboxes = serverScriptsContainer.querySelectorAll('input[type="checkbox"]');
          const isCheckAll = document.getElementById('checkAll').checked;
          checkboxes.forEach((checkbox) => {
            checkbox.checked =  isCheckAll;
          });
          handleBackendToggle([], isCheckAll);
        }

      </script>
    </head>
    <body>
      <div class="container-fluid py-2 h-100">
        <div class="row h-100">
          <div class="col-12 col-md-6 col-lg-5">


            <ul class="nav nav-tabs">
              <li class="nav-item" role="presentation">
                <button class="nav-link active" id="initial-scripts" data-bs-toggle="tab" data-bs-target="#initial-scripts-pane" type="button" role="tab" aria-controls="initial-scripts-pane" aria-selected="true">Server</button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link" id="new-scripts" data-bs-toggle="tab" data-bs-target="#new-scripts-pane" type="button" role="tab" aria-controls="new-scripts-pane" aria-selected="false">Client</button>
              </li> 
            </ul>
            <div class="tab-content" id="myTabContent">
              <div class="tab-pane fade show active" id="initial-scripts-pane" role="tabpanel" aria-labelledby="initial-scripts" tabindex="0">
                
              
              <div class="card h-100">
              <div class="card-header">
                <h3>${fileName}</h3>
              </div>
              <div class="card-body"> 
            

              <div class="btn-group w-100 mb-2" role="group" aria-label="Basic checkbox toggle button group">
                <button onclick="refreshIframe()" class="btn btn-primary w-100 btn-lg">Refresh Site</button>
                <input type="checkbox" class="btn-check"  id="checkAll" onclick="checkAll()" autocomplete="off">
                <label class="btn btn-outline-primary ms-1" for="checkAll">Check all</label>
              </div>

              <div class="mb-2">
                <input type="search" class="form-control" placeholder="Search scripts" id="server-script-search" />
              </div>

              ${
                Array.isArray(scriptMetadata)
                  ? `
                <div class="overflow-y-auto overflow-x-hidden" style="height: calc(100vh - 250px);">
                  <div class="accordion" id="serverScriptsContainer">
              ${scriptMetadata
                .map(
                  (script, index) => `
                  <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                      <div class="card card-body  p-1" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="true" aria-controls="collapse${index}">
                        <div class="d-flex">
                        <div class="d-flex flex-column flex-grow-1"> 
                          <span class="fs-6 mb-2">${script.id}</span> 
                          <small class="text-break text-muted fs-5">${
                            script.src || "Inline script"
                          }</small> 
                         </div>
                         <div  >
                           <input type="checkbox" class="form-check-input toggle-checkbox" id="script${
                             script.id
                           }" ${script.enabled ? "checked" : ""} target-id="${
                    script.id
                  }">
                         </div>
                        </div>
                      </div>
                    </h2> 
                    ${
                      script.content
                        ? `
                    <div id="collapse${index}" class="accordion-collapse collapse" aria-labelledby="heading${index}" data-bs-parent="#serverScriptsContainer">
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
          <div class="tab-pane fade" id="new-scripts-pane" role="tabpanel" aria-labelledby="new-scripts" tabindex="0">
            
            <div class="card h-100">
              <div class="card-header">
                <h3>${fileName}</h3>
              </div>
              <div class="card-body"> 

              <div class="btn-group w-100 mb-2" role="group" aria-label="Basic checkbox toggle button group">
                <button onclick="loadScripts()" class="btn btn-primary w-100 btn-lg d-none" id="cf-load-scripts">Load scripts</button>
              </div>
              
              <div class="overflow-y-auto overflow-x-hidden" style="height: calc(100vh - 250px);">
              <div class="accordion" id="accordionNewScripts">
                
              </div>
              </div>
          
              </div>
            </div>
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
       <script>

          async function onScriptToggle(id) {
            console.log('Script toggled', id);  
              const checkbox =  document.getElementById('script' + id);
              const isChecked = checkbox.checked;

              handleBackendToggle([id], isChecked);
            }

            document.querySelectorAll('.toggle-checkbox').forEach((checkbox) => {
              checkbox.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                onScriptToggle(checkbox.getAttribute('target-id'));
              });
            });

            document.getElementById('server-script-search').addEventListener('input', (event) => {
              const searchValue = event.target.value;
              const serverScriptsContainer = document.getElementById('serverScriptsContainer');
              const accordionItems = serverScriptsContainer.querySelectorAll('.accordion-item');
              accordionItems.forEach((accordionItem) => {
                const scriptId = accordionItem.querySelector('.accordion-header').innerText;
                if(scriptId.toLowerCase().includes(searchValue.toLowerCase())) {
                  accordionItem.style.display = 'block';
                } else {
                  accordionItem.style.display = 'none';
                }
              });
            });

       </script>
    </body>
  </html>
  `,
    {
      headers: { "Content-Type": "text/html" },
    }
  );
};
