(async () => {
    console.log("contentScript.js init");
    chrome.runtime.onMessage.addListener(async (obj, sender, response) => {
        const { type, value, videoId } = obj;

        console.log("load listener");
        if (type === "LOAD") {
            console.log("LOAD value: ", value);
            let blob = await fetch(value).then(r => r.blob());
            console.log("received blob: ", blob)
            // const uint8Array = new Uint8Array(value);
            // const arrayBuffer = uint8Array.buffer;

            // const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            // const blobUrl = URL.createObjectURL(blob);
            
            // Open the viewer page
            // const viewerWindow = window.open(chrome.runtime.getURL('viewer.html'), '_blank');
           
            // console.log("sending pdf blob")
            
            // // Create a function to check if the window is fully loaded
            // const checkWindowAndSendMessage = () => {
            //     if (viewerWindow && viewerWindow.document.readyState === 'complete') {
            //         console.log("Viewer window loaded, sending pdf blob");
            //         chrome.runtime.sendMessage({ type: 'PDF_BLOB_URL', url: blobUrl });
            //     } else {
            //         // Check again after a short delay
            //         console.log(viewerWindow.document.readyState);
            //         setTimeout(checkWindowAndSendMessage, 100);
            //     }
            // };

            // // Start checking
            // checkWindowAndSendMessage();

            // Function to wait for tab to be ready
            const waitForTab = () => {
                return new Promise((resolve) => {
                    // First open the window
                    const viewerWindow = window.open(chrome.runtime.getURL('viewer.html'), '_blank');
                   
                    console.log("viewerWindow: ", viewerWindow);
                    // Send a message to background script to watch for the tab
                    chrome.runtime.sendMessage({ 
                        type: 'WATCH_FOR_VIEWER_TAB' 
                    }, (response) => {
                        // This callback will be called when background script confirms tab is ready
                        console.log('got response: ', response)
                        if (response && response.tabReady) {
                            console.log("response resolved");
                            resolve();
                        }
                    });
                });
            };

            console.log('registered waitForTab handler');
            waitForTab().then(async (tab) => {
                const buffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(buffer);
                const regularArray = Array.from(uint8Array);
                console.log("sending buffer: ", buffer);
                chrome.runtime.sendMessage({ 
                    type: 'VIEWER_BLOB_URL', 
                    url: regularArray,
                });
            }).catch(error => {
                console.error('Error:', error);
            });
        }
    });
})();