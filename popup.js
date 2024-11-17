if (window.pdfjsLib) {
  console.log('Configuring PDF.js worker');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.js';
}

document.addEventListener('DOMContentLoaded', () => {
  const parseButton = document.getElementById('parseButton');
  const output = document.getElementById('output');

  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function processPDF(pdfUrl) {
    console.log("pdfUrl: ", pdfUrl);
    try {
      output.innerHTML = 'Loading PDF...';
      
      // Fetch the PDF
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();

      // Check if PDF.js is loaded
      if (!window.pdfjsLib) {
        console.error('PDF.js library not loaded!');
        output.innerHTML = 'Error: PDF.js not loaded';
        return;
      }

      // Load the PDF
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        disableFontFace: true,
        useSystemFonts: true
      });
      const pdf = await loadingTask.promise;
      console.log('PDF loaded, pages:', pdf.numPages);
      
      let fullText = `PDF URL: ${pdfUrl}\nPages: ${pdf.numPages}\n\n`;
      
      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
          output.innerHTML = `Processing page ${pageNum} of ${pdf.numPages}...`;
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map(item => item.str)
            .join(' ');
          
          fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
          console.log(`Completed page ${pageNum}`);
        } catch (pageError) {
          console.error(`Error on page ${pageNum}:`, pageError);
          fullText += `\nError extracting text from page ${pageNum}: ${pageError.message}\n`;
        }
      }
      
      output.innerHTML = fullText;
      console.log('PDF processing complete');
    } catch (error) {
      console.error('Error processing PDF:', error);
      output.innerHTML = `Error processing PDF: ${error.message}\nMake sure you're viewing a PDF file.`;
    }
  }

  parseButton.addEventListener('click', async () => {
    parseButton.disabled = true;
    try {
      const tab = await getCurrentTab();
      
      // Check if current tab is a PDF
      if (tab.url.toLowerCase().includes('.pdf') || tab.url.toLowerCase().includes('application/pdf')) {
        await processPDF(tab.url);
      } else {
        output.innerHTML = 'Current tab does not appear to be a PDF file.\nPlease open a PDF file in Chrome first.';
      }
    } catch (error) {
      console.error('Error:', error);
      output.innerHTML = `Error: ${error.message}`;
    } finally {
      parseButton.disabled = false;
    }
  });

  // Check if we're on a PDF page when popup opens
  getCurrentTab().then(tab => {
    const isPDF = tab.url.toLowerCase().includes('.pdf') || 
                 tab.url.toLowerCase().includes('application/pdf');
    parseButton.disabled = !isPDF;
    if (!isPDF) {
      output.innerHTML = 'Please open a PDF file in Chrome first.';
    }
  });
});