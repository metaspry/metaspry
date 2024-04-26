
export async function guessKeywordsGPT(html: HTMLElement): Promise<void> {
  // Extract cleaned text content from HTML body
  let content = getHTMLText(html.innerHTML || '');

  // Before sending the content add a initial prompt to GPT-3
  let initialPrompt = 'PLEASE WAIT UNTILL I SEND YOU A LAST MESSAGE THAT WILL CONTAIN "GPT3READY FOR METAGIFY" THEN WHEN YOU GET THAT MESSAGE FROM ME, GUESS THE KEYWORDS FROM TEXT I WILL SEND YOU. DO NOT REPLY WITH ANYTHING ELSE THAN "PROCEED" UNTILL YOU GET THAT MESSAGE. \n\n';
  content = initialPrompt + content;

  // Process content to send to GPT-3
  let contentArray = cutContent(content);
  let initialContent = contentArray[0];

  // local storage listener for gpt3ready boolean
  // each time gpt3ready is true, send next content to GPT-3
  chrome.storage.local.onChanged.addListener((changes) => {
    console.log('listener added');
    if (changes.gpt3ready?.newValue) {
      console.log('gpt3ready is true');
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
  console.log(initialContent);
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

function cutContent(content: string): string[] {
  const maxCharacters = 4000;
  const contentArray = [];
  while (content.length > maxCharacters) {
    contentArray.push(content.substring(0, maxCharacters));
    content = content.substring(maxCharacters);
  }
  contentArray.push(content);

  contentArray.push('GPT3READY FOR METAGIFY');

  return contentArray;
}

function getHTMLText(html: string): string {
  // Create a temporary element
  const tempElement = document.createElement('div');
  tempElement.innerHTML = html;

  // Remove script and style elements
  const scriptAndStyleElements = tempElement.querySelectorAll('script, style');
  scriptAndStyleElements.forEach(el => el.remove());

  // Extract cleaned text content
  const cleanedContent = tempElement.textContent || tempElement.innerText || '';
  const finalContent = cleanedContent.replace(/\s+/g, ' ').trim();

  return finalContent;
}
