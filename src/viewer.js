(() => {
  class MyHighlightManager {
        constructor() {
            this.highlights = new Map(); // pageNum -> highlights array
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

        getHighlights() {
          return this.highlights;
        }

        handleHighlight(selection, range) {
            const highlightId = `highlight-${Date.now()}`;
            const selectedText = selection.toString().trim();
            if (!selectedText) return;

            const rects = range.getClientRects();
            const textLayer = range.commonAncestorContainer.closest('.textLayer');
            console.log('common ancestor: ', range.commonAncestorContainer);
            console.log('textLayer: ', textLayer);
            const pdfContainer = document.getElementById('pdf-container');
            const containerRect = pdfContainer.getBoundingClientRect();

            const pdfPage = textLayer.closest('.pdf-page');
            const pageNumber = parseInt(pdfPage.getAttribute('data-page-number'), 10);

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
            if (!this.highlights.has(pageNumber)) {
                this.highlights.set(pageNumber, []);
            }
            this.highlights.get(pageNumber).push({
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

    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const inputHint = document.getElementById('inputHint');
    let currentMode = 'write';
    let rawText;
    // Initialize highlight manager after page is loaded
    window.highlightManager = new MyHighlightManager();
    highlightManager.loadHighlights();

    const modeResponses = {
        write: [
            "Here's a draft based on your input:",
            "I've written this for you:",
            "Here's what I've composed:"
        ],
        rewrite: [
            "Here's a rewritten version:",
            "I've reformulated your text as:",
            "Here's the revised version:"
        ],
        summarize: [
            "Here's a summary:",
            "Key points:",
            "In brief:"
        ]
    };

    const modeHints = {
        write: "Write mode: Express your thoughts naturally",
        rewrite: "Rewrite mode: Paste the text you want to rephrase",
        summarize: "Summarize mode: Paste the text you want to condense"
    };

    // Mode selection handling
    document.querySelectorAll('.mode-btn').forEach(button => {
        button.addEventListener('click', () => {
            // Update active button
            document.querySelector('.mode-btn.active').classList.remove('active');
            button.classList.add('active');
            
            // Update current mode
            currentMode = button.dataset.mode;
            
            // Update input hint
            inputHint.textContent = modeHints[currentMode];
            
            // Update input placeholder
            userInput.placeholder = `Type your message for ${currentMode} mode...`;
        });
    });

    function highlightsToString() {
      const highlights = window.highlightManager.getHighlights();
      
      let highlightString = "Here are the highlights that the users have noted. Highlights are passages that users have found interesting and please use the highlights as references to response:\n"

      const sortedKeys = Array.from(highlights.keys()).sort((a, b) => a - b);
      console.log('sortedKeys: ', sortedKeys);
      for (const key of sortedKeys) {
        highlightString += 'Page ' + key.toString() + '\n';
        console.log("hightlights: ", highlights)
        console.log("key: ", key)
        console.log("highlights.get(): ", highlights.get(key))
        for (const highlight of highlights.get(key)) {
          console.log('highlight: ', highlight.text)
          highlightString += '-' + highlight.text;
        }
      }

      return highlightString;
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        // Add user's message
        addMessage(message, 'question', currentMode);

        // Get random response for current mode
        const modeResponseList = modeResponses[currentMode];
        const response = modeResponseList[Math.floor(Math.random() * modeResponseList.length)];
        const highlightString = highlightsToString();

        // Add bot's answer after a short delay
        setTimeout(async () => {
            // Simulate different responses based on mode
            let processedResponse = response;
            if (currentMode === 'summarize') {
              console.log("[SUMMARIZE] rawText: ", rawText);
              console.log("highlights: ", window.highlightManager.getHighlights());
              console.log("highlightString: ", highlightString);
              const summarizer = await ai.summarizer.create({
                sharedContext: "",
                type: "tl;dr",
                length: "medium"
              });

              const summary = await summarizer.summarize(highlightString, {
                context: message
              });
              
              processedResponse += "\n" + summary;
            } else if (currentMode === 'rewrite') {
                const rewriter = await ai.rewriter.create({
                  sharedContext: "",
                });

                const rewriteText = await rewriter.rewrite(highlightString, {
                  context: message
                });
                processedResponse += "\n" + rewriteText;
            } else {
                const writer = await ai.writer.create({
                  sharedContext: "",
                });

                const writeText = await writer.write(highlightString, {
                  context: message
                });
                processedResponse += "\n" + writeText;
            }
            addMessage(processedResponse, 'answer', currentMode);
        }, 500);

        // Clear input
        userInput.value = '';
    }

    function addMessage(text, type, mode) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        
        const modeSpan = document.createElement('span');
        modeSpan.classList.add('message-mode');
        modeSpan.textContent = `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`;
        
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        
        messageDiv.appendChild(modeSpan);
        messageDiv.appendChild(textSpan);
        chatBox.appendChild(messageDiv);
        
        // Scroll to bottom
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Simulate different processing based on mode
    function createBriefSummary(text) {
        return `${text.split(' ').slice(0, 5).join(' ')}...`;
    }

    function rewriteText(text) {
        return text.split('.').reverse().join('. ');
    }

    function expandText(text) {
        return text + " [Additional context would be added here]";
    }

    // Allow sending message with Enter key
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

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
            // return true; // Keep message channel open
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
                rawText = await extractPDFText(pdf, numPages);
                console.log('raw text: ', rawText);

                const parser = new FlexibleReferenceParser();
                const parsedRefs = parser.parseReferences(rawText);

                // Pretty print the results
                console.log(JSON.stringify(parsedRefs, null, 2));

            } catch (error) {
                console.error('Error extracting PDF text:', error);
            }
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