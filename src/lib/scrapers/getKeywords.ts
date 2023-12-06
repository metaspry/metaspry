import nlp from 'compromise';
import { Keywords } from '../components/KeywordsInfo/Keywords';

const stopWords: string[] = [
  // Add more comprehensive stop words here
  'the', 'and', 'for', 'that', 'with', 'you', 'your', 'not', 
  'are', 'this', 'but', 'have', 'from', 'they', 'one', 'had', 
  'word', 'what', 'were', 'when', 'can', 'said', 'there', 'use', 
  'each', 'which', 'she', 'how', 'their', 'will', 'other', 'about', 
  'out', 'many', 'then', 'them', 'these', 'some', 'her', 'would', 
  'make', 'like', 'him', 'into', 'time', 'has', 'look', 'two', 
  'more', 'write', 'see', 'number', 'way', 'could', 'people', 
  'than', 'first', 'been', 'call', 'who', 'its', 'now', 'find', 
  'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part',
  '!important'
];

export async function getKeywords(html: HTMLElement): Promise<Keywords[]> {
  const getTextContent = (element: HTMLElement): string => {
    const ignoreTags: string[] = ['script', 'style'];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          return ignoreTags.includes((node.parentNode as HTMLElement)?.tagName?.toLowerCase())
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      }
    );
    let textContent = '';

    while (walker.nextNode()) {
      textContent += (walker.currentNode as Text).textContent?.trim() + ' ';
    }

    return textContent;
  };

  const textContent = getTextContent(html);
  const doc = nlp(textContent).normalize(); // Normalize text
  const terms: string[] = doc.terms().out('array').map((term: string) => term.toLowerCase()); // Extract terms and convert to lowercase

  let termFrequency: { [key: string]: number } = {}; // Initialize with an empty object

  terms.forEach((term: string) => {
    if (term.length > 2 && !stopWords.includes(term)) {
      termFrequency[term] = (termFrequency[term] || 0) + 1;
    }
  });

  const totalTerms: number = terms.length;
  const keywords: Keywords[] = Object.keys(termFrequency)
    .map((term: string) => ({
      keyword: term,
      count: termFrequency[term] || 0, // Ensure count is defined as a number
      percent: ((termFrequency[term] ?? 0) / totalTerms) * 100, // Use optional chaining operator and multiply by 100 for percentage
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return keywords;
}