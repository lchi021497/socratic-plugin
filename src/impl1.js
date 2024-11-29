document.addEventListener('DOMContentLoaded', async () => {
  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const highlightsList = document.getElementById('highlights-list');
  const clearButton = document.getElementById('clear-highlights');
  const exportButton = document.getElementById('export-highlights');
  const toggleButton = document.getElementById('toggle-highlights');
  let highlightsVisible = true;

  async function loadHighlights() {
    const result = await chrome.storage.local.get('highlights');
    const highlights = result.highlights || {};
    
    if (Object.keys(highlights).length === 0) {
      highlightsList.innerHTML = '<div class="empty-state">No highlights yet</div>';
      return;
    }

    highlightsList.innerHTML = '';
    Object.entries(highlights).forEach(([pageNumber, pageHighlights]) => {
      pageHighlights.forEach(highlight => {
        const div = document.createElement('div');
        div.className = 'highlight-item';
        div.innerHTML = `
          <div class="highlight-text">"${highlight.text}"</div>
          <div class="highlight-meta">
            Page ${pageNumber}
            <span style="display: inline-block; width: 12px; height: 12px; background: ${highlight.color}; border-radius: 2px; margin-left: 5px;"></span>
          </div>
        `;
        highlightsList.appendChild(div);
      });
    });
  }

  // Load initial highlights
  await loadHighlights();

  // Clear highlights
  clearButton.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all highlights?')) {
      await chrome.storage.local.remove('highlights');
      await loadHighlights();
      
      // Send message to content script to refresh highlights
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'refreshHighlights' });
    }
  });

  // Export highlights
  exportButton.addEventListener('click', async () => {
    const result = await chrome.storage.local.get('highlights');
    const highlights = result.highlights || {};
    
    let exportText = 'PDF Highlights Export\n\n';
    Object.entries(highlights).forEach(([pageNumber, pageHighlights]) => {
      pageHighlights.forEach(highlight => {
        exportText += `Page ${pageNumber}:\n`;
        exportText += `"${highlight.text}"\n\n`;
      });
    });

    // Create blob and download
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-highlights.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Toggle highlights visibility
  toggleButton.addEventListener('click', async () => {
    highlightsVisible = !highlightsVisible;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { 
      action: 'toggleHighlights',
      visible: highlightsVisible
    });
  });
});