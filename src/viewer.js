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

    const handlePDF = async (blob) => {
        try {
            // const pdfjsSrc = chrome.runtime.getURL("src/pdf.mjs");
            const pdfjs = window.pdfjsLib;
            if (!pdfjs) {
                throw new Error('PDF.js failed to load');
            }
            const pdfWorkerSrc = chrome.runtime.getURL("src/pdf.worker.mjs");
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
    
            // Fetch the first page
            const page = await pdf.getPage(1);
            console.log('Page loaded');
    
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
    
            // Prepare canvas
            const canvas = document.getElementById('the-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
    
            // Render PDF page
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
            console.log('Page rendered');
    
            // Clean up
            URL.revokeObjectURL(message.url);
        } catch (error) {
            console.error('Error loading PDF:', {
                message: error.message,
                name: error.name,
                stack: error.stack,
                fullError: error
            });
        }
    };

    // Also set up when DOM is loaded (as backup)
    window.addEventListener('DOMContentLoaded', () => {
        setupMessageListener();
        console.log("Viewer page loaded and listener set up");
    });
})();