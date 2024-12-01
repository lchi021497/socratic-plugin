<!DOCTYPE html>
<html>
  <head>
    <title>PDF.js Highlight Tracker</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <style>
      #pdf-container {
          width: 800px;
          margin: 0 auto;
          position: relative;
      }
      .pdf-page {
          position: relative;
          margin-bottom: 20px;
      }
      .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          opacity: 0.2;
          line-height: 1.0;
      }
      .textLayer > span {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
      }
      .textLayer ::selection {
          background: rgba(0, 0, 255, 0.3);
      }
      .highlight {
          position: absolute;
          background-color: rgba(255, 255, 0, 0.3);
          cursor: pointer;
      }
      #highlight-list {
          position: fixed;
          right: 20px;
          top: 20px;
          width: 300px;
          background: white;
          padding: 10px;
          border: 1px solid #ccc;
          max-height: 80vh;
          overflow-y: auto;
      }
    </style>
  </head>
  <body>
    <div id="pdf-container"></div>
    <div id="highlight-list">
      <h3>Highlights</h3>
      <div id="highlights-container"></div>
    </div>

    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      class MyHighlightManager10 {
          constructor() {
              this.highlights = new Map(); // pageNum -> highlights array
              this.currentPage = 1;
              this.setupListeners();
          }

          setupListeners() {
              document.addEventListener('mouseup', () => {
                  const selection = window.getSelection();
                  if (!selection.rangeCount) return;

                  const range = selection.getRangeAt(0);
                  const container = range.commonAncestorContainer.parentElement;

                  if (container) {
                      this.handleHighlight(selection, range);
                  }
              });
          }

          handleHighlight(selection, range) {
              const highlightId = `highlight-${Date.now()}`;
              const selectedText = selection.toString().trim();
              if (!selectedText) return;

              const rects = range.getClientRects();
              const textLayer = range.commonAncestorContainer.parentElement.closest('.textLayer');
              const pdfContainer = document.getElementById('pdf-container');
              const containerRect = pdfContainer.getBoundingClientRect();

              // Create highlight elements
              for (const rect of rects) {
                  const highlight = document.createElement('div');
                  highlight.className = 'highlight';
                  highlight.setAttribute('data-highlight-id', highlightId);

                  // Position highlight
                  highlight.style.left = (rect.left - containerRect.left) + 'px';
                  highlight.style.top = (rect.top - containerRect.top) + 'px';
                  highlight.style.width = rect.width + 'px';
                  highlight.style.height = rect.height + 'px';

                  pdfContainer.appendChild(highlight);
              }

              // Save highlight data
              if (!this.highlights.has(this.currentPage)) {
                  this.highlights.set(this.currentPage, []);
              }
              this.highlights.get(this.currentPage).push({
                  id: highlightId,
                  text: selectedText,
                  timestamp: new Date().toISOString()
              });

              this.updateHighlightsList();
              this.saveHighlights();

              // Clear selection
              selection.removeAllRanges();
          }

          updateHighlightsList() {
              const container = document.getElementById('highlights-container');
              container.innerHTML = '';

              this.highlights.forEach((pageHighlights, pageNum) => {
                  const pageSection = document.createElement('div');
                  pageSection.innerHTML = `<h4>Page ${pageNum}</h4>`;

                  pageHighlights.forEach(highlight => {
                      const highlightDiv = document.createElement('div');
                      highlightDiv.style.marginBottom = '10px';
                      highlightDiv.innerHTML = `
                          <div style="font-size: 0.8em; color: #666;">
                              ${new Date(highlight.timestamp).toLocaleString()}
                          </div>
                          <div style="margin: 5px 0;">${highlight.text}</div>
                          <button onclick="highlightManager.removeHighlight('${highlight.id}', ${pageNum})">
                              Remove
                          </button>
                      `;
                      pageSection.appendChild(highlightDiv);
                  });

                  container.appendChild(pageSection);
              });
          }

          removeHighlight(highlightId, pageNum) {
              // Remove highlight elements
              const highlights = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
              highlights.forEach(h => h.remove());

              // Remove from data structure
              const pageHighlights = this.highlights.get(pageNum);
              const index = pageHighlights.findIndex(h => h.id === highlightId);
              if (index !== -1) {
                  pageHighlights.splice(index, 1);
                  if (pageHighlights.length === 0) {
                      this.highlights.delete(pageNum);
                  }
              }

              this.updateHighlightsList();
              this.saveHighlights();
          }

          saveHighlights() {
              // Convert Map to array for storage
              const highlightsArray = Array.from(this.highlights.entries());
              localStorage.setItem('pdfHighlights', JSON.stringify(highlightsArray));
          }

          loadHighlights() {
              const saved = localStorage.getItem('pdfHighlights');
              if (saved) {
                  // Convert array back to Map
                  this.highlights = new Map(JSON.parse(saved));
                  this.updateHighlightsList();
              }
          }
      }

      async function renderPage(page, pageNumber) {
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const pageContainer = document.createElement('div');
          pageContainer.className = 'pdf-page';
          pageContainer.setAttribute('data-page-number', pageNumber);

          // Create canvas for this specific page
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          pageContainer.style.height = viewport.height + 'px';
          pageContainer.style.width = viewport.width + 'px';

          const textLayerDiv = document.createElement('div');
          textLayerDiv.className = 'textLayer';

          pageContainer.appendChild(canvas);
          pageContainer.appendChild(textLayerDiv);
          document.getElementById('pdf-container').appendChild(pageContainer);

          // Render page content
          const renderContext = {
              canvasContext: context,
              viewport: viewport
          };
          await page.render(renderContext).promise;

          // Render text layer
          const textContent = await page.getTextContent();
          await pdfjsLib.renderTextLayer({
              textContent: textContent,
              container: textLayerDiv,
              viewport: viewport,
              textDivs: []
          });
      }

      async function loadPDF(pdfUrl) {
          try {
              const loadingTask = pdfjsLib.getDocument(pdfUrl);
              const pdf = await loadingTask.promise;

              // Get total pages
              const numPages = pdf.numPages;

              for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                  const page = await pdf.getPage(pageNum);
                  await renderPage(page, pageNum);
              }

              // Initialize highlight manager after page is loaded
              window.highlightManager = new MyHighlightManager10();
              highlightManager.loadHighlights();

          } catch (error) {
              console.error('Error loading PDF:', error);
          }
      }

      // Load your PDF
      loadPDF('https://arxiv.org/pdf/1712.01815');
    </script>
  </body>
</html>
