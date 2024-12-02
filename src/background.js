console.log('Background script starting...');
try {
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("background add listener");
    if (message.type === 'VIEWER_BLOB_URL') {
        console.log("received pdf blob: ", message);
        chrome.tabs.query({url: 'chrome-extension://*/viewer.html'}, function(tabs) {
            console.log("tabs: ", tabs)
            console.log("background message: ", message);
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'VIEWER_BLOB_URL',
                url: message.url
            });
        });
        return true;
    }
    if (message.type === 'WATCH_FOR_VIEWER_TAB') {
        console.log('received WATCH_FOR_VIEWER_TAB');
        // Return true immediately to keep the message channel open
        chrome.tabs.query({ url: 'chrome-extension://*/viewer.html' }, (tabs) => {
            if (tabs && tabs.length > 0) {
                console.log("tab ready");
                const tab = tabs[0];
                const listener = (tabId, info) => {
                    if (tabId === tab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        sendResponse({ tabReady: true });
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            } else {
                console.log('tab not ready');
                sendResponse({ tabReady: false });
            }
        });
        return true;
    }
});
console.log('Message listener successfully registered');
} catch (error) {
    console.error('Error setting up message listener:', error);
}