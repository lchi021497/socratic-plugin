document.getElementById('uploadDocument').addEventListener('submit', handleSubmit);
async function getActiveTabURL() {
    const tabs = await chrome.tabs.query({
        currentWindow: true,
        active: true
    });
  
    return tabs[0];
}

async function handleSubmit(event) {
    console.log('handleSubmit');
    event.preventDefault();
    const file = document.getElementById('myFile').files[0];
    console.log(file);

    const fileReader = new FileReader();
    // Fix the Promise wrapper to wait for onload
    const fileContents = () => {
        return new Promise((resolve, reject) => {
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = () => reject(fileReader.error);
            fileReader.readAsArrayBuffer(file);
        });
    };


    try {
        const arrayBuffer = await fileContents();
        console.log("File loaded successfully");
        
        const activeTab = await getActiveTabURL();
        console.log("Active tab:", activeTab);

        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        console.log("Blob URL:", blobUrl);  // Should now show blob:chrome-extension://...

        chrome.tabs.sendMessage(
            activeTab.id, 
            {
                type: "LOAD",
                value: blobUrl
            }
        );
    } catch (error) {
        console.error("Error processing file:", error);
    }

}
