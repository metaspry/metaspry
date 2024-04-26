if(typeof browser !== "undefined"){
	var qtest = browser.sidebarAction;
	if(typeof qtest !== "undefined"){
		browser.browserAction.onClicked.addListener(function(){
			browser.sidebarAction.toggle();
		});
	}
}

chrome.sidePanel.setPanelBehavior({openPanelOnActionClick: true}).catch((error) => console.error(error));
chrome.runtime.onInstalled.addListener(e => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getHTML') {
    let queryOptions = { active: true, lastFocusedWindow: true };
    chrome.tabs.query(queryOptions, (tabs) => {
      let [tab] = tabs;
      if (tab) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            return document.documentElement.outerHTML;
          }
        }, (result) => {
          const htmlContent = result[0]?.result;
          if (htmlContent) {
            sendResponse({ html: htmlContent });
          } else {
            sendResponse({ html: null }); // Send null if HTML content is not found
          }
        });
      } else {
        sendResponse({ html: null }); // Send null if no tab is found
      }
    });
    return true; // Ensure sendResponse is called asynchronously
  }
});


// Define your openGPT3Prompt function
function openGPT3Prompt(content) {
  const gpt3URL = 'https://chat.openai.com/';

  chrome.tabs.create({ url: gpt3URL }, (newTab) => {
    if (newTab) {
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: newTab.id },
          function: (content) => {
            const promptTextArea = document.getElementById('prompt-textarea');
            const sendButton = document.querySelector('[data-testid="send-button"]');
            console.log('promptTextArea', promptTextArea);
            console.log('sendButton', sendButton);
            if (promptTextArea && sendButton) {
              promptTextArea.value = content;
              promptTextArea.dispatchEvent(new Event('input', { bubbles: true }));
              let buttonParent = sendButton.parentElement;
              sendButton.click();
              
              // then add listener to the parent and wait for button with same data-testid to appear
              let observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                      if (node.dataset.testid === 'send-button') {
                        // set local store gpt3ready to true
                        chrome.storage.local.set({ gpt3ready: true });
                        console.log(chrome.storage.local.get('gpt3ready'));
                        observer.disconnect();
                      }
                    });
                  }
                });
              });

              observer.observe(buttonParent, { childList:true, subtree: true });
            } else {
              console.error('Failed to open the GPT-3.');
            }
          },
        args: [content], // Pass the content as an argument to the executed function
        });
      }, 2000); // Adjust the delay as needed
    } else {
      console.error('Failed to open the GPT-3.');
    }
  });
}

// get current tab and check if it's a gpt3 tab
function continueGPT3Prompt(content) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let tab = tabs[0];
    console.log('tab', tab);
    if (tab.url.includes('chat.openai.com')) {
      // find the prompt textarea and send content like before
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (content) => {
          const promptTextArea = document.getElementById('prompt-textarea');
          const sendButton = document.querySelector('[data-testid="send-button"]');
          console.log('promptTextArea', promptTextArea);
          console.log('sendButton', sendButton);
          if (promptTextArea && sendButton) {
            promptTextArea.value = content;
            promptTextArea.dispatchEvent(new Event('input', { bubbles: true }));
            let buttonParent = sendButton.parentElement;
            sendButton.click();
            
            // then add listener to the parent and wait for button with same data-testid to appear
            let observer = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                  mutation.addedNodes.forEach((node) => {
                    if (node.dataset.testid === 'send-button') {
                      // set local store gpt3ready to true
                      chrome.storage.local.set({ gpt3ready: true });
                      console.log(chrome.storage.local.get('gpt3ready'));
                      observer.disconnect();
                    }
                  });
                }
              });
            });

            observer.observe(buttonParent, { childList:true, subtree: true });
          } else {
            console.error('Failed to open the GPT-3.');
          }
        },
      args: [content], // Pass the content as an argument to the executed function
      });
    }
  });
}

// Add a message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'openGPT3Prompt') {
    chrome.storage.local.set({ gpt3ready: false });
    openGPT3Prompt(request.content);
    sendResponse({ received: true });
  }
  if (request.message === 'continueGPT3Prompt') {
    // set local store gpt3ready to false
    chrome.storage.local.set({ gpt3ready: false });
    console.log('continueGPT3Prompt');
    continueGPT3Prompt(request.content);
    sendResponse({ received: true });
  }
});
