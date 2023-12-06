
export async function guessKeywordsGPT(html: HTMLElement): Promise<void> {
  // get html content from the page
  const content = html.querySelector('body')?.innerText || '';
  const cleanedContent = content.replace(/\s+/g, ' ').trim();
  
  // process content to send to GPT-3
  let contentArray = cutContent(cleanedContent);
  let initialContent = contentArray[0];

  // local storage listener for gpt3ready boolean
  // each time gpt3ready is true, send next content to GPT-3
  chrome.storage.local.onChanged.addListener((changes) => {
    if (changes.gpt3ready?.newValue) {
      contentArray.shift();
      if (contentArray.length > 0) {
        initialContent = contentArray[0] || '';
        continueGPT3Prompt(initialContent);
      }

      // remove listener
      chrome.storage.local.onChanged.removeListener((changes) => {
        console.log('listener removed');
      });
    }
  });

  console.log('initial content');
  // send content to GPT-3
  await openGPT3Prompt(initialContent || '');
}

export async function openGPT3Prompt(content: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'openGPT3Prompt', content }, (response) => {
      if (response && response.received) {
        resolve(true);
      } else {
        reject(new Error('Failed to trigger GPT-3 prompt'));
      }
    });
  });
}

async function continueGPT3Prompt(content: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ message: 'continueGPT3Prompt', content }, (response) => {
      if (response && response.received) {
        resolve(true);
      } else {
        reject(new Error('Failed to continue GPT-3 prompt'));
      }
    });
  });
}

function addInitialPrompt(content: string): string {
  return `I will send you messages of content please do not respond to each of them untill I say "end of message you can guess keywords".
  Try to guess keywords from the following content:
  \n\n${content}`;
}

function addEndOfMessage(content: string): string {
  return `${content}\n\nend of message you can guess keywords`;
}

function cutContent(content: string): string[] {
  let combinedContent = addInitialPrompt(addEndOfMessage(content));
  const maxCharacters = 2000;
  const contentArray = [];
  while (combinedContent.length > maxCharacters) {
    contentArray.push(combinedContent.substring(0, maxCharacters));
    combinedContent = combinedContent.substring(maxCharacters);
  }
  contentArray.push(combinedContent);

  return contentArray;
}