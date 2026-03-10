import { getToolBySlug } from '../src/actions/tools/get-tool';

(async () => {
  const tool = await getToolBySlug('mixart-ai', 'en');
  console.log(JSON.stringify(tool?.tagDetails, null, 2));
})();
