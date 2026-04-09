const fs = require("fs");

let code = fs.readFileSync("app.js", "utf8");

// 1. Add btnLoadServer reference at the top DOM section
const domPos = code.indexOf(
  'const errorMsg = document.getElementById("error-msg");',
);
code =
  code.substring(0, domPos) +
  'const btnLoadServer = document.getElementById("btn-load-server");\n' +
  code.substring(domPos);

// 2. Add API pulling functions after the IndexedDB processDirectoryHandle block
const idxLogic = code.indexOf(
  "async function processDirectoryHandle(dirHandle) {",
);
const endIdxDb = code.indexOf("function findFileInTree(node, path) {");
if (idxLogic > -1 && endIdxDb > -1) {
  const chunk = `
if (btnLoadServer) {
  btnLoadServer.addEventListener("click", async () => {
    try {
      errorMsg.textContent = "Loading library from server...";
      errorMsg.classList.remove("hidden");
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Server API not available. Did you start server.js?");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load directory.");
      
      const rootNode = data.rootNode;
      if (!rootNode.children || rootNode.children.length === 0) {
        showError("No EPUB or TXT files found in the 'Stored' folder on the server.");
        return;
      }
      
      const hydrateNodeFiles = (node) => {
        if (node.isDir) {
          node.children.forEach(hydrateNodeFiles);
        } else {
          node.file = {
            name: node.name,
            webkitRelativePath: node.path.substring(1), // Remove leading slash
            isRemote: true,
            url: node.path,
            size: 0 // Mock size for storage key
          };
        }
      }
      hydrateNodeFiles(rootNode);

      errorMsg.classList.add("hidden");
      btnFileTreeToggle.classList.remove("hidden");
      renderFileTree([rootNode], fileTreeList);
      
      const lastFileRelPath = localStorage.getItem("epubReader_last_file_" + rootNode.name);
      let targetFile = null;
      if (lastFileRelPath) targetFile = findFileInTree(rootNode, lastFileRelPath);
      
      if (targetFile) handleFile(targetFile);
      else {
        destroyCurrentBook();
        showReader();
        fileTreeSidebar.classList.add("active");
      }
    } catch (e) {
      showError(e.message || "Cannot connect to server API");
    }
  });
}

`;
  code = code.substring(0, endIdxDb) + chunk + code.substring(endIdxDb);
  console.log("Added remote server loading logic.");
}

// 3. Modify handleFile to intercept remote files and fetch them instead of parsing them as standard File blobs
// Let's replace function handleFile(file)
const hFileStart = code.indexOf("function handleFile(file) {");
const hFileSnippet = `
async function fetchRemoteFile(fileMeta) {
  try {
    errorMsg.textContent = "Downloading " + fileMeta.name + "...";
    errorMsg.classList.remove("hidden");
    
    // Attempt cache first? We can just fetch it directly
    const res = await fetch(fileMeta.url);
    if (!res.ok) throw new Error("Failed to fetch file from server.");
    const blob = await res.blob();
    
    // Construct a faux File object
    const f = new File([blob], fileMeta.name, { type: blob.type });
    Object.defineProperty(f, "webkitRelativePath", { value: fileMeta.webkitRelativePath });
    
    errorMsg.classList.add("hidden");
    // Call the original synchronous handler now that it's physically in memory
    handleLocalFile(f);
  } catch (e) {
    showError(e.message);
  }
}

function handleFile(file) {
  if (file.isRemote) {
    fetchRemoteFile(file);
    return;
  }
  handleLocalFile(file);
}

function handleLocalFile(file) {`;

code =
  code.substring(0, hFileStart) +
  hFileSnippet +
  code.substring(hFileStart + "function handleFile(file) {".length);
console.log("Renamed handleFile");

fs.writeFileSync("app.js", code, "utf8");
