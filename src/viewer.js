(() => {
    const setupMessageListener = () => {
        console.log("Setting up message listener");
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("Received message in viewer:", message);
            
            if (message.type === 'VIEWER_BLOB_URL') {
                console.log("got message: ", message);
                const pdfBlobURL = message.url;
                console.log('got pdfBlobURL: ', pdfBlobURL);
                
                // Send acknowledgment back
                sendResponse({ received: true });
                
                handlePDF(message.url);
            }
            return true; // Keep message channel open
        });
    };

    class MyHighlightManager {
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
        const scale = 1.0;
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

    const handlePDF = async (blob) => {
        try {
            // const pdfjsSrc = chrome.runtime.getURL("src/pdf.js");
            const pdfjs = window.pdfjsLib;
            if (!pdfjs) {
                throw new Error('PDF.js failed to load');
            }
            const pdfWorkerSrc = chrome.runtime.getURL("src/pdf.worker.js");
            pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

            const uint8Array = new Uint8Array(blob);
            // console.log("url message: ", message.url);
            // let blob = await fetch(message.url).then(r => r.blob());

            console.log("loaded blob: ", uint8Array);
            const arrayBuffer = uint8Array.buffer;

            // Load and render the PDF
            const loadingTask = pdfjs.getDocument(arrayBuffer);
            const pdf = await loadingTask.promise;
            console.log('PDF loaded');

            // Get total pages
            const numPages = pdf.numPages;

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                await renderPage(page, pageNum);
            }

            // Initialize highlight manager after page is loaded
            window.highlightManager = new MyHighlightManager();
            highlightManager.loadHighlights();

          } catch (error) {
              console.error('Error loading PDF:', error);
          }
        
            // // Fetch the first page
            // const page = await pdf.getPage(1);
            // console.log('Page loaded');
    
            // const scale = 1.5;
            // const viewport = page.getViewport({ scale });
    
            // // Prepare canvas
            // const canvas = document.getElementById('the-canvas');
            // const context = canvas.getContext('2d');
            // canvas.height = viewport.height;
            // canvas.width = viewport.width;
    
            // // Render PDF page
            // const renderContext = {
            //     canvasContext: context,
            //     viewport: viewport
            // };
            // await page.render(renderContext).promise;
            // console.log('Page rendered');
    
            // // Clean up
            // URL.revokeObjectURL(message.url);
    };

    // Also set up when DOM is loaded (as backup)
    window.addEventListener('DOMContentLoaded', () => {
        setupMessageListener();
        console.log("Viewer page loaded and listener set up");
    });
})();