import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const TTF_USER_AGENT = 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const WEIGHT_NAMES = {
  '100': 'Thin',
  '200': 'ExtraLight',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black'
};

const DEFAULT_PT_SAMPLE_TEXT = 'Todos os seres humanos nascem livres e iguais em dignidade e direitos. São dotados de razão e consciência e devem agir em relação uns aos outros com espírito de fraternidade.';

// Helper to fetch Google Font metadata from GitHub google/fonts repo
async function fetchGoogleFontMetadata(family) {
  const slug = family.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dirs = ['ofl', 'apache', 'ufl'];
  
  for (const dir of dirs) {
    try {
      const metaUrl = `https://raw.githubusercontent.com/google/fonts/main/${dir}/${slug}/METADATA.pb`;
      const res = await fetch(metaUrl);
      if (res.ok) {
        const text = await res.text();
        const name = text.match(/name:\s*"([^"]+)"/)?.[1] || family;
        const designer = text.match(/designer:\s*"([^"]+)"/)?.[1] || 'Google';
        const license = text.match(/license:\s*"([^"]+)"/)?.[1] || 'OFL';
        const category = text.match(/category:\s*"([^"]+)"/)?.[1] || '';
        
        let varFontUrl = null;
        let varFontName = null;
        const varMatch = text.match(/filename:\s*"([^"]+\[[^"]+\]\.ttf)"/);
        if (varMatch) {
          varFontName = varMatch[1];
          varFontUrl = `https://raw.githubusercontent.com/google/fonts/main/${dir}/${slug}/${varFontName}`;
        }

        return { name, designer, license, category, dir, slug, varFontName, varFontUrl };
      }
    } catch {}
  }

  return { name: family, designer: 'Google', license: 'OFL', category: '', dir: 'ofl', slug, varFontName: null, varFontUrl: null };
}

// Helper to parse CSS font-face declarations for TTF fonts
function parseCssFontFaces(cssText, family) {
  const blocks = cssText.split('@font-face').slice(1);
  const fonts = [];
  const seen = new Set();

  for (const block of blocks) {
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const urlMatch = block.match(/url\(([^)]+)\)/);
    if (!urlMatch) continue;

    const weight = weightMatch ? weightMatch[1].trim() : '400';
    const style = styleMatch ? styleMatch[1].trim() : 'normal';
    const fontUrl = urlMatch[1].replace(/[\"']/g, '').trim();

    const key = `${weight}-${style}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let styleName = WEIGHT_NAMES[weight] || weight;
    if (style.toLowerCase() === 'italic') {
      styleName = (weight === '400' ? 'Italic' : `${styleName} Italic`);
    }

    fonts.push({
      url: fontUrl,
      name: `${family} ${styleName}`,
      style: `${styleName} (${weight})`,
      familyName: family,
      familyUrl: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, '+'))}`,
      isGoogle: true,
      provider: 'google'
    });
  }

  return fonts;
}

// Fetch Adobe Font family or collection
async function fetchAdobeFont(input) {
  let slug = input.trim();
  let isCollection = false;

  if (slug.includes('fonts.adobe.com/collections/')) {
    isCollection = true;
    const match = slug.match(/\/collections\/([^/?#]+)/i);
    if (match) slug = match[1];
  } else if (slug.includes('fonts.adobe.com/fonts/')) {
    const match = slug.match(/\/fonts\/([^/?#]+)/i);
    if (match) slug = match[1];
  } else if (slug.startsWith('http')) {
    const match = slug.match(/\/(fonts|collections)\/([^/?#]+)/i);
    if (match) {
      isCollection = match[1].toLowerCase() === 'collections';
      slug = match[2];
    }
  } else {
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const targetUrl = isCollection
    ? `https://fonts.adobe.com/collections/${slug}`
    : `https://fonts.adobe.com/fonts/${slug}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (!response.ok) {
    throw new Error(`Adobe Fonts retornou status ${response.status}`);
  }

  const text = await response.text();

  if (isCollection) {
    const jsonStart = text.indexOf('{"fontpack":{"all_valid_slugs":');
    if (jsonStart === -1) {
      throw new Error('Não foi possível encontrar dados da coleção Adobe Fonts.');
    }
    const data = text.substring(jsonStart);
    const jsonEnd = data.indexOf('</script>');
    const json = JSON.parse(data.substring(0, jsonEnd));

    const defaultLang = json.fontpack.font_variations?.[0]?.default_language || 'pt';
    const sampleText = json.textSampleData?.textSamples?.[defaultLang]?.list || DEFAULT_PT_SAMPLE_TEXT;

    const fonts = (json.fontpack.font_variations || []).map(v => ({
      url: `https://use.typekit.net/pf/tk/${v.opaque_id}/${v.fvd}/a?unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3&ec_token=3bb2a6e53c9684ffdc9a9bf71d5b2a620e68abb153386c46ebe547292f11a96176a59ec4f0c7aacfef2663c08018dc100eedf850c284fb72392ba910777487b32ba21c08cc8c33d00bda49e7e2cc90baff01835518dde43e2e8d5ebf7b76545fc2687ab10bc2b0911a141f3cf7f04f3cac438a135f`,
      name: v.full_name,
      style: v.variation_name,
      familyName: json.fontpack.name,
      familyUrl: `https://fonts.adobe.com/fonts/${v.family_slug}`,
      isAdobe: true,
      provider: 'adobe'
    }));

    return {
      provider: 'adobe',
      isCollection: true,
      name: json.fontpack.name,
      designers: [{
        name: json.fontpack.contributor_credit || 'Adobe Fonts',
        url: targetUrl
      }],
      sampleText: sampleText,
      fonts: fonts
    };
  } else {
    const jsonStart = text.indexOf('{"family":{"slug":');
    if (jsonStart === -1) {
      throw new Error('Não foi possível encontrar dados da família no Adobe Fonts.');
    }
    const data = text.substring(jsonStart);
    const jsonEnd = data.indexOf('</script>');
    const json = JSON.parse(data.substring(0, jsonEnd));

    const defaultLang = json.family.default_language || 'pt';
    const sampleText = json.textSampleData?.textSamples?.[defaultLang]?.list || DEFAULT_PT_SAMPLE_TEXT;

    const designers = (json.family.designers || []).map(d => ({
      name: d.name,
      url: json.designer_info?.[d.slug]?.url ? `https://fonts.adobe.com${json.designer_info[d.slug].url}` : ''
    }));

    const fonts = (json.family.fonts || []).map(f => ({
      url: `https://use.typekit.net/pf/tk/${f.family.web_id}/${f.font.web.fvd}/a?unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3&ec_token=3bb2a6e53c9684ffdc9a9bf71d5b2a620e68abb153386c46ebe547292f11a96176a59ec4f0c7aacfef2663c08018dc100eedf850c284fb72392ba910777487b32ba21c08cc8c33d00bda49e7e2cc90baff01835518dde43e2e8d5ebf7b76545fc2687ab10bc2b0911a141f3cf7f04f3cac438a135f`,
      name: f.name,
      style: f.variation_name,
      familyName: json.family.name,
      familyUrl: `https://fonts.adobe.com/fonts/${json.family.slug}`,
      isAdobe: true,
      provider: 'adobe'
    }));

    return {
      provider: 'adobe',
      name: json.family.name,
      designers: designers,
      sampleText: sampleText,
      fonts: fonts
    };
  }
}

// Fetch Google Font family
async function fetchGoogleFont(family, customSampleText = null, isPt = false) {
  const queryFamily = encodeURIComponent(family);
  let cssText = '';

  const v1Url = `https://fonts.googleapis.com/css?family=${queryFamily}:100,200,300,400,500,600,700,800,900,100i,200i,300i,400i,500i,600i,700i,800i,900i`;
  let response = await fetch(v1Url, { headers: { 'User-Agent': TTF_USER_AGENT } });
  if (response.ok) {
    cssText = await response.text();
  } else {
    const v2Url = `https://fonts.googleapis.com/css2?family=${queryFamily}:ital,wght@0,100..900;1,100..900&display=swap`;
    response = await fetch(v2Url, { headers: { 'User-Agent': TTF_USER_AGENT } });
    if (response.ok) {
      cssText = await response.text();
    } else {
      const v2Plain = `https://fonts.googleapis.com/css2?family=${queryFamily}&display=swap`;
      response = await fetch(v2Plain, { headers: { 'User-Agent': TTF_USER_AGENT } });
      if (response.ok) {
        cssText = await response.text();
      } else {
        const v1Plain = `https://fonts.googleapis.com/css?family=${queryFamily}`;
        response = await fetch(v1Plain, { headers: { 'User-Agent': TTF_USER_AGENT } });
        if (response.ok) {
          cssText = await response.text();
        }
      }
    }
  }

  const fonts = parseCssFontFaces(cssText, family);
  const meta = await fetchGoogleFontMetadata(family);

  if (meta.varFontUrl) {
    fonts.unshift({
      url: meta.varFontUrl,
      name: `${family} Variable`,
      style: 'Variable Font (All Axes)',
      familyName: family,
      familyUrl: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, '+'))}`,
      isGoogle: true,
      isVariable: true,
      provider: 'google'
    });
  }

  if (fonts.length === 0) {
    throw new Error(`Nenhum estilo encontrado para a fonte Google "${family}".`);
  }

  const sampleText = customSampleText || (isPt ? DEFAULT_PT_SAMPLE_TEXT : 'Todos os seres humanos nascem livres e iguais em dignidade e direitos.');

  return {
    provider: 'google',
    name: family,
    designers: [{
      name: meta.designer || 'Google Fonts',
      url: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, '+'))}`
    }],
    license: meta.license || 'OFL',
    category: meta.category,
    sampleText: sampleText,
    fonts: fonts
  };
}

// Endpoint to fetch styles and download info for an Adobe Font family or collection
app.get('/api/adobe-font', async (req, res) => {
  const query = req.query.url || req.query.family || req.query.slug;
  if (!query || typeof query !== 'string') {
    return res.status(400).send('Parâmetro url ou family faltando');
  }

  try {
    const data = await fetchAdobeFont(query);
    res.json(data);
  } catch (err) {
    res.status(404).send(`Erro ao carregar do Adobe Fonts: ${err.message}`);
  }
});

// Endpoint to fetch styles and download info for a Google Font family
app.get('/api/google-font', async (req, res) => {
  let family = req.query.family;
  const inputUrl = req.query.url;
  let customSampleText = req.query.sampleText;
  let isPt = false;

  if (inputUrl) {
    try {
      const parsedUrl = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
      const specimenMatch = parsedUrl.pathname.match(/\/specimen\/([^/?#]+)/i);
      if (specimenMatch) {
        family = decodeURIComponent(specimenMatch[1]).replace(/\+/g, ' ');
      } else if (parsedUrl.searchParams.get('query')) {
        family = parsedUrl.searchParams.get('query');
      }

      if (parsedUrl.searchParams.get('preview.text')) {
        customSampleText = parsedUrl.searchParams.get('preview.text');
      }
      const langParam = parsedUrl.searchParams.get('preview.lang') || parsedUrl.searchParams.get('lang');
      if (langParam && langParam.toLowerCase().includes('pt')) {
        isPt = true;
      }
    } catch (e) {
      console.error('URL parse error:', e);
    }
  }

  if (req.query.lang && req.query.lang.toLowerCase().includes('pt')) {
    isPt = true;
  }

  if (!family || typeof family !== 'string') {
    return res.status(400).send('Nome da família ou URL de espécime do Google Fonts inválida');
  }

  family = family.trim().replace(/\+/g, ' ');

  try {
    const data = await fetchGoogleFont(family, customSampleText, isPt);
    res.json(data);
  } catch (err) {
    res.status(404).send(err.message);
  }
});

// Unified endpoint: smart detection for Google Fonts, Adobe Fonts, or by plain name
app.get('/api/font', async (req, res) => {
  let query = req.query.query || req.query.url || req.query.family;
  const requestedProvider = req.query.provider; // 'adobe' | 'google' | undefined
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).send('Consulta vazia');
  }

  query = query.trim();
  let forceProvider = requestedProvider;

  if (query.toLowerCase().startsWith('adobe:') || query.toLowerCase().startsWith('adobe/')) {
    forceProvider = 'adobe';
    query = query.substring(6).trim();
  } else if (query.toLowerCase().startsWith('google:') || query.toLowerCase().startsWith('google/')) {
    forceProvider = 'google';
    query = query.substring(7).trim();
  }

  const raw = query;

  // 1. Explicit Adobe URL or forced Adobe provider
  if (forceProvider === 'adobe' || raw.includes('fonts.adobe.com') || raw.includes('use.typekit.net')) {
    try {
      const data = await fetchAdobeFont(raw);
      return res.json(data);
    } catch (err) {
      if (forceProvider === 'adobe') {
        return res.status(404).send(`Adobe Fonts: ${err.message}`);
      }
    }
  }

  // 2. Explicit Google Fonts URL or forced Google provider
  if (forceProvider === 'google' || raw.includes('fonts.google.com') || raw.includes('fonts.googleapis.com')) {
    try {
      let family = raw;
      let sampleText = null;

      if (raw.includes('fonts.google.com') || raw.includes('fonts.googleapis.com') || raw.startsWith('http://') || raw.startsWith('https://')) {
        const parsedUrl = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        const isCatalog = !parsedUrl.pathname.includes('/specimen/') && !parsedUrl.searchParams.get('query');
        if (isCatalog) {
          return res.redirect(`/api/google-catalog?url=${encodeURIComponent(raw)}`);
        }
        const specimenMatch = parsedUrl.pathname.match(/\/specimen\/([^/?#]+)/i);
        if (specimenMatch) {
          family = decodeURIComponent(specimenMatch[1]).replace(/\+/g, ' ');
        } else if (parsedUrl.searchParams.get('query')) {
          family = parsedUrl.searchParams.get('query');
        }
        sampleText = parsedUrl.searchParams.get('preview.text');
      }

      const data = await fetchGoogleFont(family, sampleText, true);
      return res.json(data);
    } catch (err) {
      if (forceProvider === 'google') {
        return res.status(404).send(`Google Fonts: ${err.message}`);
      }
    }
  }

  // 3. Plain font name: Check both or prioritize based on match quality
  // If user searched for a known Adobe family (or if Adobe returns full family), check Adobe
  try {
    const adobeData = await fetchAdobeFont(raw);
    if (adobeData && adobeData.fonts && adobeData.fonts.length > 1) {
      // Adobe has rich full family styles
      return res.json(adobeData);
    }
  } catch {}

  // Check Google Fonts
  try {
    const googleData = await fetchGoogleFont(raw, null, true);
    return res.json(googleData);
  } catch (gErr) {
    // If not found in Google Fonts, try Adobe Fonts
    try {
      const data = await fetchAdobeFont(raw);
      return res.json(data);
    } catch (aErr) {
      return res.status(404).send(`Fonte "${raw}" não encontrada nem no Google Fonts nem no Adobe Fonts.`);
    }
  }
});

// Endpoint to fetch catalog / collection (e.g. https://fonts.google.com/?lang=pt_Latn...)
app.get('/api/google-catalog', async (req, res) => {
  const inputUrl = req.query.url;
  let isPt = true;
  let customSampleText = null;

  if (inputUrl) {
    try {
      const parsedUrl = new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`);
      const langParam = parsedUrl.searchParams.get('preview.lang') || parsedUrl.searchParams.get('lang');
      if (langParam && !langParam.toLowerCase().includes('pt')) {
        isPt = false;
      }
      if (parsedUrl.searchParams.get('preview.text')) {
        customSampleText = parsedUrl.searchParams.get('preview.text');
      }
    } catch {}
  }

  const catalogList = [
    'Google Sans Flex',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Poppins',
    'Inter',
    'Lato',
    'Playfair Display',
    'Nunito',
    'Raleway',
    'Merriweather',
    'Plus Jakarta Sans',
    'Work Sans',
    'Lora',
    'Oswald'
  ];

  const fonts = [];
  for (const family of catalogList) {
    try {
      const queryFamily = encodeURIComponent(family);
      const url = `https://fonts.googleapis.com/css?family=${queryFamily}:400`;
      const response = await fetch(url, { headers: { 'User-Agent': TTF_USER_AGENT } });
      if (response.ok) {
        const css = await response.text();
        const urlMatch = css.match(/url\(([^)]+)\)/);
        if (urlMatch) {
          const fontUrl = urlMatch[1].replace(/[\"']/g, '').trim();
          fonts.push({
            url: fontUrl,
            name: family,
            style: 'Regular 400',
            familyName: family,
            familyUrl: `https://fonts.google.com/specimen/${encodeURIComponent(family.replace(/\s+/g, '+'))}`,
            isGoogle: true,
            provider: 'google',
            isCatalogItem: true
          });
        }
      }
    } catch {}
  }

  const sampleText = customSampleText || (isPt ? DEFAULT_PT_SAMPLE_TEXT : 'Todos os seres humanos nascem livres e iguais em dignidade e direitos.');

  res.json({
    provider: 'google',
    name: isPt ? 'Google Fonts (Português / Latn)' : 'Google Fonts Collection',
    designers: [{
      name: 'Google Fonts',
      url: inputUrl || 'https://fonts.google.com/?lang=pt_Latn&preview.script=Latn&preview.lang=pt_Latn'
    }],
    sampleText: sampleText,
    fonts: fonts
  });
});

// CORS proxy endpoint to fetch font files and Adobe Fonts pages reliably
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch target URL: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send(`Proxy error: ${err.message}`);
  }
});

// Serve static directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TypeRip server listening on http://0.0.0.0:${PORT}`);
});
