(() => {
    let isProcessing = false;
    const setupMessageListener = () => {
        console.log("Setting up message listener");
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("Received message in viewer:", message);
            
            if (message.type === 'VIEWER_BLOB_URL' && !isProcessing) {
                isProcessing = true;
                console.log("got message: ", message);
                const pdfBlobURL = message.url;
                console.log('got pdfBlobURL: ', pdfBlobURL);
                
                // Send acknowledgment back
                sendResponse({ received: true });
                
                handlePDF(message.url)
                    .finally(() => {
                        isProcessing = false;  // Reset flag after processing
                    });
            }
            return true; // Keep message channel open
        });
    };

    class FlexibleReferenceParser {
        constructor() {
          this.sectionPattern = /^(?:References|Bibliography|Works Cited|Literature|Citations)$/im;
          this.referencePattern = /(?:^|\n)\s*(\d+)\.\s+([^\n](?:(?!\n\s*\d+\.).)*)/gms;
        }
      
        findReferencesSection(text) {
          const lines = text.split('\n');
          let startIndex = -1;
          let endIndex = lines.length;
      
          for (let i = 0; i < lines.length; i++) {
            if (this.sectionPattern.test(lines[i].trim())) {
              startIndex = i + 1;
              break;
            }
          }
      
          if (startIndex === -1) {
            console.warn('No explicit references section found. Searching entire text.');
            return text;
          }
      
          for (let i = startIndex; i < lines.length; i++) {
            if (/^[A-Z][^a-z]*$/.test(lines[i].trim()) && i > startIndex + 1) {
              endIndex = i;
              break;
            }
          }
      
          return lines.slice(startIndex, endIndex).join('\n');
        }
      
        parseAuthorString(authorStr) {
          // Handle "et al." case
          if (authorStr.includes("et al")) {
            return authorStr.trim();
          }
          
          // Split on commas and &, then clean up
          const parts = authorStr.split(/(?:,\s*|\s*&\s*)/);
          const authors = parts
            .filter(part => part.trim().length > 0)
            .map(author => author.trim());
          
          if (authors.length > 1) {
            const lastAuthor = authors.pop();
            return `${authors.join(', ')} & ${lastAuthor}`;
          }
          return authors[0];
        }
      
        attemptStructuredParse(reference) {
          const structured = {
            raw: reference.trim(),
            authors: null,
            year: null,
            title: null,
            publication: null,
            volume: null,
            pages: null
          };
      
          // Extract year (always in parentheses at the end)
          const yearMatch = reference.match(/\((\d{4})\)/);
          if (yearMatch) {
            structured.year = yearMatch[1];
          }
      
          // Split into main parts using the first period that's followed by an uppercase letter
          const mainParts = reference.split(/\.(?=\s*[A-Z])/);
          
          if (mainParts.length >= 1) {
            // First part is always authors
            structured.authors = this.parseAuthorString(mainParts[0]);
          }
          
          if (mainParts.length >= 2) {
            // Second part is title
            structured.title = mainParts[1].trim();
          }
          
          if (mainParts.length >= 3) {
            // Third part is publication details
            const pubPart = mainParts[2];
            
            // Extract volume and pages if they exist
            const volumePages = pubPart.match(/(\d+),\s*(\d+)[-–](\d+)/);
            if (volumePages) {
              structured.volume = volumePages[1];
              structured.pages = `${volumePages[2]}-${volumePages[3]}`;
              // Publication name is everything before the volume/pages
              structured.publication = pubPart.split(/\s*\d+,/)[0].trim();
            } else {
              // If no volume/pages, just take everything up to the year
              structured.publication = pubPart.replace(/\s*\(\d{4}\).*$/, '').trim();
            }
          }
      
          return structured;
        }
      
        parseReferences(text) {
          const referencesSection = this.findReferencesSection(text);
          const references = [];
          let match;
      
          while ((match = this.referencePattern.exec(referencesSection)) !== null) {
            const [_, number, content] = match;
            const parsedReference = this.attemptStructuredParse(content);
            references.push({
              number,
              ...parsedReference
            });
          }
      
          return references;
        }
      }

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
            console.log("this.highlights add: ", this.highlights);

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
                    
                    // Create timestamp div
                    const timestampDiv = document.createElement('div');
                    timestampDiv.style.fontSize = '0.8em';
                    timestampDiv.style.color = '#666';
                    timestampDiv.textContent = new Date(highlight.timestamp).toLocaleString();
                    
                    // Create text div
                    const textDiv = document.createElement('div');
                    textDiv.style.margin = '5px 0';
                    textDiv.textContent = highlight.text;
                    
                    // Create remove button
                    const removeButton = document.createElement('button');
                    removeButton.textContent = 'Remove';
                    
                    // Add event listener instead of inline onclick
                    removeButton.addEventListener('click', () => {
                        console.log('highlights @ remove: ', this.highlights)
                        console.log("remove pageNum: ", pageNum)
                        this.removeHighlight(highlight.id, pageNum);
                    });
                    
                    // Append all elements
                    highlightDiv.appendChild(timestampDiv);
                    highlightDiv.appendChild(textDiv);
                    highlightDiv.appendChild(removeButton);
                    pageSection.appendChild(highlightDiv);
                });

                container.appendChild(pageSection);
            });
            console.log("this.highlights after update: ", this.highlights);
        }

        removeHighlight(highlightId, pageNum) {
            console.log('this.highlights: ', this.highlights);
            // Remove highlight elements
            const highlights = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
            highlights.forEach(h => h.remove());

            console.log('highlights: ', highlights);
            
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
            console.log('loading highlights')
            const saved = localStorage.getItem('pdfHighlights');
            if (saved) {
                // Convert array back to Map
                this.highlights = new Map(JSON.parse(saved));
                this.updateHighlightsList();
            }
            console.log('loaded highlights');
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

    async function extractPDFText(pdf, numPages) {
        let rawText = "";
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            
            // Wait for page rendering
            await renderPage(page, pageNum);
            
            // Get text content
            const textContent = await page.getTextContent();
            const textItems = textContent.items;
            
            let line = 0;
            // Process text items
            for (let i = 0; i < textItems.length; i++) {
                if (line !== textItems[i].transform[5]) {
                    if (line !== 0) {
                        rawText += '\r\n';
                    }
                    line = textItems[i].transform[5];
                }
                rawText += textItems[i].str;
            }
        }
        
        return rawText;
    }

    const handlePDF = async (blob) => {
        console.log("handlePDF");
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

            try {
                const rawText = await extractPDFText(pdf, numPages);
                console.log('raw text: ', rawText);

                const parser = new FlexibleReferenceParser();
                const parsedRefs = parser.parseReferences(rawText);

                // Pretty print the results
                console.log(JSON.stringify(parsedRefs, null, 2));

            } catch (error) {
                console.error('Error extracting PDF text:', error);
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