export async function getMetaTags(html: HTMLElement) {
  const metaTags = html.querySelectorAll('meta');
  const metaTagsObj: { [key: string]: string } = {};
  metaTags.forEach((tag) => {
    const property = tag.getAttribute('property');
    const content = tag.getAttribute('content');
    if (property && content) {
      metaTagsObj[property] = content;
    }
  });
  return metaTagsObj;
}