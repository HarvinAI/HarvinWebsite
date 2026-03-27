/**
 * Zero-API news classifier & data extractor.
 *
 * Uses regex patterns on headline + snippet to:
 *   1. Classify news type (funding, hiring, acquisition, etc.)
 *   2. Extract structured data (amount, round, person, role, etc.)
 *   3. Map to the closest HarvinAI DB category
 *
 * No LLM, no API calls — runs instantly on thousands of articles.
 */

// ── News type detection patterns ──────────────────────────────────────────
// Order matters: first match wins. More specific patterns first.

const NEWS_PATTERNS = [
  {
    type: 'funding',
    patterns: [
      /\braises?\b.*?\$[\d,.]+\s*(million|mn|m|billion|bn|b|crore|cr|lakh|k)\b/i,
      /\braises?\b.*?(?:rs|inr|₹)\.?\s*[\d,.]+\s*(crore|cr|lakh|million|mn)\b/i,
      /\braised\b.*?\$[\d,.]+/i,
      /\braised\b.*?(?:rs|inr|₹)\.?\s*[\d,.]+/i,
      /\bsecures?\b.*?\$[\d,.]+/i,
      /\bsecures?\b.*?(?:funding|investment|capital)/i,
      /\b(?:series\s*[a-h]|seed\s*round|pre.?seed|pre.?series|bridge\s*round)\b.*?\b(?:fund|rais|invest|secur)/i,
      /\b(?:fund|rais|invest|secur).*?\b(?:series\s*[a-h]|seed\s*round|pre.?seed)\b/i,
      /\bfunding\s*(?:round|of)\b.*?\$[\d,.]+/i,
      /\bfunding\s*(?:round|of)\b.*?(?:rs|inr|₹)/i,
      /\b(?:venture\s*capital|vc\s*fund|angel\s*invest|pe\s*fund).*?\binvest/i,
      /\bIPO\b.*?\b(?:file|launch|list|plan|set|price)/i,
      /\b(?:file|launch|plan).*?\bIPO\b/i,
      /\bgets?\s*\$[\d,.]+.*?\b(?:fund|invest|back)/i,
      /\b(?:fresh|new)\s*(?:funding|capital|investment)\b/i,
      /\bled\s*by\b.*?\b(?:fund|capital|venture|partner)/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'shutdown',
    patterns: [
      /\b(?:shuts?\s*down|wind(?:s|ing)?\s*(?:down|up)|close[sd]?\s*(?:operations|shop|down))\b/i,
      /\b(?:bankrupt|insolvency|liquidat|dissolv)\b/i,
      /\blayoffs?\b.*?\b\d+/i,
      /\blays?\s*off\b.*?\b\d+/i,
      /\b(?:fires?|terminat|let\s*go|downsiz).*?\b\d+.*?\b(?:employee|worker|staff|people)\b/i,
      /\b\d+.*?\b(?:employee|worker|staff).*?\b(?:laid\s*off|fired|let\s*go|cut)\b/i,
      /\bmass\s*layoff/i,
      /\b(?:cease|stop|end|halt).*?\boperation/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'acquisition',
    patterns: [
      /\bacquire[sd]?\b/i,
      /\bacquisition\b.*?\b(?:of|by|deal|complete|announce)\b/i,
      /\bmerger\b.*?\b(?:with|between|announce|complete)\b/i,
      /\bmerge[sd]?\s*with\b/i,
      /\btakeover\b/i,
      /\bbuyout\b/i,
      /\bbuy[s]?\s*(?:out|up)\b.*?\b(?:company|startup|firm|business|stake)\b/i,
      /\bacquihire/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'hiring',
    patterns: [
      /\bappoints?\b.*?\b(?:as|new)\s+(?:CEO|CTO|CFO|COO|CMO|CPO|CRO|CHRO|CIO|president|chief)\b/i,
      /\b(?:CEO|CTO|CFO|COO|CMO|CPO|CRO|CHRO|CIO)\b.*?\bappoint/i,
      /\bnames?\b.*?\b(?:as|new)\s+(?:CEO|CTO|CFO|COO|CMO|CPO|president|chief|head|director|VP)\b/i,
      /\bhires?\b.*?\b(?:CEO|CTO|CFO|COO|CMO|CPO|VP|director|head\s*of|president|chief)\b/i,
      /\b(?:new|former|ex-?)\s*(?:CEO|CTO|CFO|COO|CMO|CPO|VP|director)\b.*?\b(?:join|appoint|hire|name)\b/i,
      /\bropes?\s*in\b.*?\b(?:as|from|ex)\b/i,
      /\b(?:elevates?|promotes?)\b.*?\b(?:to|as)\s+(?:CEO|CTO|CFO|COO|CMO|CPO|VP|SVP|EVP|director|head|president|managing\s*director)\b/i,
      /\bjoins?\b.*?\bas\b.*?\b(?:CEO|CTO|CFO|COO|CMO|CPO|VP|SVP|director|head|president|chief)\b/i,
      /\bmass\s*hir/i,
      /\bplans?\s*to\s*hire\b.*?\b\d+/i,
      /\bhiring\s*(?:spree|drive|push|plan)\b/i,
      /\b(?:to\s*hire|recruit)\b.*?\b\d{2,}.*?\b(?:people|employee|engineer|developer|worker)\b/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'partnership',
    patterns: [
      /\bpartners?\s*(?:with|ship)\b/i,
      /\bpartnership\b.*?\b(?:with|between|announce)\b/i,
      /\bjoint\s*venture\b/i,
      /\btie[sd]?\s*up\b.*?\bwith\b/i,
      /\bties?\s*up\b.*?\bwith\b/i,
      /\bstrategic\s*(?:alliance|collaboration|partnership|tie)\b/i,
      /\bcollaborat(?:e[sd]?|ion)\b.*?\bwith\b/i,
      /\bsigns?\s*(?:deal|agreement|MOU|pact)\b.*?\bwith\b/i,
    ],
    confidence: 0.7,
  },
  {
    type: 'expansion',
    patterns: [
      /\bexpands?\s*(?:to|into|in|across)\b/i,
      /\bexpansion\b.*?\b(?:into|in|to|plan|new)\b/i,
      /\b(?:enter|entering|enters)\s*(?:the\s+)?(?:Indian|India|US|UK|European|Asian|SE\s*Asia|Middle\s*East|African|global)\s*market/i,
      /\bopen[s]?\s*(?:new|first|its)\s*(?:store|office|warehouse|center|centre|facility|plant|factory|hub)\b/i,
      /\blaunch(?:es|ed|ing)?\s*(?:in|across|into)\b.*?\b(?:market|countr|cit|state|region)\b/i,
      /\b(?:new|open)\s*(?:\d+\s*)?(?:store|outlet|branch|office|warehouse|hub)\b/i,
      /\bgoes?\s*(?:global|international)\b/i,
      /\binternational\s*expansion\b/i,
    ],
    confidence: 0.7,
  },
  {
    type: 'launch',
    patterns: [
      /\blaunch(?:es|ed|ing)?\b.*?\b(?:new|its|a)\s+(?:product|service|platform|app|tool|feature|brand|line|model|version)\b/i,
      /\b(?:new|its|a)\s+(?:product|service|platform|app|tool|feature|brand)\b.*?\blaunch/i,
      /\bunveil[s]?\b.*?\b(?:new|its|a)\b/i,
      /\bintroduc(?:e[sd]?|ing)\b.*?\b(?:new|its|a)\b/i,
      /\brolls?\s*out\b/i,
      /\b(?:debut|premiere)[s]?\b/i,
      /\bnew\s*(?:product|service|offering|feature|version|update|model|line)\b.*?\b(?:announc|launch|releas|unveil|introduc)\b/i,
    ],
    confidence: 0.65,
  },
  {
    type: 'regulatory',
    patterns: [
      /\b(?:RBI|SEBI|TRAI|CCI|FSSAI|DPIIT|government|ministry|regulator)\b.*?\b(?:ban|order|rule|fine|penalt|notice|guideline|policy|circular|mandat|restrict|approv)\b/i,
      /\b(?:ban|order|rule|fine|penalt|notice|guideline|policy|mandat|restrict|approv).*?\b(?:RBI|SEBI|TRAI|CCI|FSSAI|government|ministry|regulator)\b/i,
      /\bregulat(?:ion|ory|or)\b.*?\b(?:new|change|update|impact|hit|affect|crack|tighten)\b/i,
      /\bcompliance\b.*?\b(?:issue|fail|violat|breach|concern)\b/i,
      /\b(?:new|updated?|proposed?)\s*(?:regulation|policy|rule|guideline|norm|law)\b/i,
      /\b(?:fined?|penalt|penaliz)\b.*?\b(?:for|by|over)\b/i,
    ],
    confidence: 0.7,
  },
];

// ── Amount extraction ─────────────────────────────────────────────────────

const AMOUNT_PATTERNS = [
  // $30M, $1.5B, $500K
  { re: /\$\s*([\d,.]+)\s*(billion|bn|b)\b/i,     mul: 1000 },
  { re: /\$\s*([\d,.]+)\s*(million|mn|m)\b/i,      mul: 1 },
  { re: /\$\s*([\d,.]+)\s*(thousand|k)\b/i,         mul: 0.001 },
  { re: /\$\s*([\d,.]+)\b/i,                         mul: null }, // raw $number, guess by magnitude
  // Rs/INR/₹ amounts
  { re: /(?:rs|inr|₹)\.?\s*([\d,.]+)\s*(crore|cr)\b/i,  mul: 0.12 }, // 1cr ≈ $120K ≈ 0.12M
  { re: /(?:rs|inr|₹)\.?\s*([\d,.]+)\s*(lakh)\b/i,       mul: 0.0012 }, // 1L ≈ $1.2K
  { re: /(?:rs|inr|₹)\.?\s*([\d,.]+)\s*(million|mn)\b/i, mul: 0.012 }, // Rs1M ≈ $12K
  { re: /(?:rs|inr|₹)\.?\s*([\d,.]+)\s*(billion|bn)\b/i, mul: 12 },
  // Worded: "100 crore", "5 million"
  { re: /([\d,.]+)\s*(crore|cr)\b/i,               mul: 0.12 },
  { re: /([\d,.]+)\s*(billion|bn)\b.*?\$?\s*(?:funding|raised|investment|round)/i, mul: 1000 },
  { re: /([\d,.]+)\s*(million|mn)\b.*?\$?\s*(?:funding|raised|investment|round)/i, mul: 1 },
];

function extractAmount(text) {
  for (const { re, mul } of AMOUNT_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (isNaN(num)) continue;

      let amountUSD;
      if (mul === null) {
        // Raw $number — guess: if >1000 it's probably thousands, etc.
        if (num >= 1_000_000_000) amountUSD = num / 1_000_000;
        else if (num >= 1_000_000) amountUSD = num / 1_000_000;
        else if (num >= 1000) amountUSD = num / 1_000_000; // likely in full dollars
        else amountUSD = num; // likely already in millions
      } else {
        amountUSD = num * mul;
      }

      // Rebuild display string
      const rawMatch = m[0].trim();
      return {
        amount: rawMatch.startsWith('$') || rawMatch.startsWith('₹') || /^(?:rs|inr)/i.test(rawMatch)
          ? rawMatch
          : '$' + rawMatch,
        amountUSD: Math.round(amountUSD * 10) / 10,
      };
    }
  }
  return { amount: null, amountUSD: null };
}

// ── Funding round extraction ──────────────────────────────────────────────

const ROUND_PATTERNS = [
  { re: /\bpre[- ]?seed\b/i,          round: 'Pre-Seed' },
  { re: /\bseed\s*(?:round|funding|stage|capital)?\b/i, round: 'Seed' },
  { re: /\bpre[- ]?series\s*a\b/i,    round: 'Pre-Series A' },
  { re: /\bseries\s*a\b/i,            round: 'Series A' },
  { re: /\bseries\s*b\b/i,            round: 'Series B' },
  { re: /\bseries\s*c\b/i,            round: 'Series C' },
  { re: /\bseries\s*d\b/i,            round: 'Series D' },
  { re: /\bseries\s*e\b/i,            round: 'Series E' },
  { re: /\bseries\s*f\b/i,            round: 'Series F' },
  { re: /\bseries\s*[g-h]\b/i,        round: 'Late Stage' },
  { re: /\bbridge\s*(?:round|funding)?\b/i, round: 'Bridge' },
  { re: /\bdebt\s*(?:round|funding|financing|facility)?\b/i, round: 'Debt' },
  { re: /\bIPO\b/,                     round: 'IPO' },
  { re: /\bangel\s*(?:round|funding|investment)?\b/i, round: 'Angel' },
  { re: /\bpre[- ]?IPO\b/i,           round: 'Pre-IPO' },
  { re: /\bgrowth\s*(?:round|stage|equity)\b/i, round: 'Growth' },
];

function extractRound(text) {
  for (const { re, round } of ROUND_PATTERNS) {
    if (re.test(text)) return round;
  }
  return null;
}

// ── Investor extraction ───────────────────────────────────────────────────

const KNOWN_INVESTORS = [
  'Sequoia', 'Sequoia Capital', 'Accel', 'Accel Partners', 'Tiger Global',
  'SoftBank', 'Softbank Vision Fund', 'Lightspeed', 'Lightspeed Venture Partners',
  'Matrix Partners', 'Elevation Capital', 'Peak XV', 'Peak XV Partners',
  'Nexus Venture Partners', 'Blume Ventures', 'Kalaari Capital', 'Chiratae Ventures',
  'Bessemer', 'Bessemer Venture Partners', 'Insight Partners', 'General Atlantic',
  'Temasek', 'GIC', 'KKR', 'Warburg Pincus', 'Carlyle', 'Blackstone',
  'Goldman Sachs', 'Morgan Stanley', 'JP Morgan', 'Norwest', 'DST Global',
  'A91 Partners', 'Fireside Ventures', 'India Quotient', '3one4 Capital',
  'SAIF Partners', 'Steadview Capital', 'Falcon Edge', 'B Capital',
  'Ribbit Capital', 'QED Investors', 'Andreessen Horowitz', 'a16z',
  'Y Combinator', 'YC', 'Founders Fund', 'Khosla Ventures',
  'Benchmark', 'Greylock', 'IVP', 'NEA', 'Coatue', 'D1 Capital',
  'Prosus', 'Naspers', 'Tencent', 'Alibaba', 'Google Ventures', 'GV',
  'Microsoft', 'Amazon', 'Meta', 'Intel Capital', 'Qualcomm Ventures',
  'Samsung', 'Cisco Investments', 'Salesforce Ventures', 'PayPal Ventures',
  'Mastercard', 'Visa', 'HDFC', 'ICICI Venture', 'SBI', 'Kotak',
  'Ratan Tata', 'Anupam Mittal', 'Kunal Shah', 'Binny Bansal',
  'Sachin Bansal', 'Deepinder Goyal', 'Zerodha', 'Nithin Kamath',
  'Info Edge', 'Naukri', 'Titan Capital', 'First Cheque',
  'Z47', 'Bertelsmann India', 'Omidyar Network', 'Venture Highway',
  'Iron Pillar', 'WestBridge Capital', 'Alteria Capital', 'InnoVen Capital',
  'Stride Ventures', 'Trifecta Capital', 'Northern Arc', 'Avendus',
];

// Build a case-insensitive lookup
const INVESTOR_LOOKUP = new Map();
for (const name of KNOWN_INVESTORS) {
  INVESTOR_LOOKUP.set(name.toLowerCase(), name);
}

function extractInvestors(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const [key, name] of INVESTOR_LOOKUP) {
    if (lower.includes(key) && !found.includes(name)) {
      found.push(name);
    }
  }

  // Also try "led by X" pattern
  const ledBy = text.match(/\bled\s+by\s+([A-Z][\w\s&]+?)(?:\s*(?:and|,|\.|with|along))/i);
  if (ledBy && found.length === 0) {
    const investor = ledBy[1].trim();
    if (investor.length > 2 && investor.length < 50) found.push(investor);
  }

  return found.slice(0, 6);
}

// ── Hiring extraction ─────────────────────────────────────────────────────

const C_SUITE = ['CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CPO', 'CRO', 'CHRO', 'CIO', 'CISO', 'CLO'];
const VP_ROLES = ['VP', 'SVP', 'EVP', 'Vice President', 'Senior Vice President'];
const DIR_ROLES = ['Director', 'Head of', 'Managing Director'];

function extractHiringData(text) {
  let person = null;
  let role = null;
  let roleLevel = null;
  let hiringCount = null;

  // Mass hiring / layoffs
  const massHire = text.match(/\b(?:hire|recruit|add|onboard)\b.*?\b(\d[\d,]*)\s*(?:\+\s*)?(?:people|employee|staff|worker|engineer|developer|talent)/i)
    || text.match(/\b(\d[\d,]*)\s*(?:\+\s*)?(?:people|employee|staff|worker|engineer|developer)\b.*?\b(?:hire|recruit)/i)
    || text.match(/\bhiring\s*(?:spree|drive|push|plan).*?\b(\d[\d,]*)/i);
  if (massHire) {
    hiringCount = parseInt(massHire[1].replace(/,/g, ''), 10);
    roleLevel = 'mass-hiring';
    return { person: null, role: `${hiringCount}+ hires`, roleLevel, hiringCount };
  }

  // Layoffs
  const layoff = text.match(/\b(?:lay(?:s|ed|ing)?\s*off|fire[sd]?|cut[s]?|let\s*go|terminat)\b.*?\b(\d[\d,]*)\s*(?:people|employee|staff|worker|job)/i)
    || text.match(/\b(\d[\d,]*)\s*(?:people|employee|staff|worker|job).*?\b(?:laid?\s*off|fire[sd]?|cut|let\s*go)/i);
  if (layoff) {
    hiringCount = parseInt(layoff[1].replace(/,/g, ''), 10);
    roleLevel = 'layoff';
    return { person: null, role: `${hiringCount} layoffs`, roleLevel, hiringCount };
  }

  // C-Suite appointment: "appoints John Doe as CEO"
  const appointPattern = /\b(?:appoints?|names?|hires?|elevates?|promotes?|ropes?\s*in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:as\s+)?(?:new\s+)?(?:its?\s+)?(?:new\s+)?((?:Chief\s+\w+\s*Officer|CEO|CTO|CFO|COO|CMO|CPO|CRO|CHRO|CIO|CISO|VP|SVP|EVP|Vice\s+President|Director|Head\s+of\s+\w+|Managing\s+Director|President|General\s+Manager))/i;
  const appt = appointPattern.exec(text);
  if (appt) {
    person = appt[1].trim();
    role = appt[2].trim();
  }

  // "X joins as Y"
  if (!person) {
    const joinPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+joins?\s+.*?\bas\b\s+((?:Chief\s+\w+\s*Officer|CEO|CTO|CFO|COO|CMO|CPO|VP|SVP|Director|Head\s+of\s+\w+|President|Managing\s+Director))/i;
    const jp = joinPattern.exec(text);
    if (jp) { person = jp[1].trim(); role = jp[2].trim(); }
  }

  // Fallback: just find a role mention
  if (!role) {
    for (const r of C_SUITE) {
      if (new RegExp(`\\b${r}\\b`).test(text)) { role = r; break; }
    }
    if (!role) {
      for (const r of VP_ROLES) {
        if (new RegExp(`\\b${r}\\b`, 'i').test(text)) { role = r; break; }
      }
    }
    if (!role) {
      for (const r of DIR_ROLES) {
        if (new RegExp(`\\b${r}\\b`, 'i').test(text)) { role = r; break; }
      }
    }
  }

  // Determine role level
  if (role) {
    const upper = role.toUpperCase();
    if (C_SUITE.some(r => upper.includes(r)) || upper.includes('CHIEF') || upper.includes('PRESIDENT')) {
      roleLevel = 'c-suite';
    } else if (VP_ROLES.some(r => upper.includes(r.toUpperCase()))) {
      roleLevel = 'vp';
    } else if (DIR_ROLES.some(r => upper.toUpperCase().includes(r.toUpperCase()))) {
      roleLevel = 'director';
    } else {
      roleLevel = 'staff';
    }
  }

  return { person, role, roleLevel, hiringCount };
}

// ── Acquisition extraction ────────────────────────────────────────────────

function extractAcquisitionData(text) {
  // "X acquires Y"
  let m = text.match(/\b([A-Z][\w\s&'.]+?)\s+(?:acquires?|buys?|takes?\s*over)\s+([A-Z][\w\s&'.]+?)(?:\s+(?:for|in|to|deal|$))/i);
  if (m) return { acquirer: m[1].trim(), target: m[2].trim(), dealAmount: extractAmount(text).amount };

  // "Acquisition of Y by X"
  m = text.match(/\bacquisition\s+of\s+([A-Z][\w\s&'.]+?)\s+(?:by|from)\s+([A-Z][\w\s&'.]+?)(?:\s|$)/i);
  if (m) return { acquirer: m[2].trim(), target: m[1].trim(), dealAmount: extractAmount(text).amount };

  return { acquirer: null, target: null, dealAmount: null };
}

// ── Company name extraction ───────────────────────────────────────────────
// Tries to find the primary company from the headline

function extractCompanyName(text) {
  // Remove source suffixes like "- Economic Times", "| TechCrunch"
  const clean = text.replace(/\s*[-–|]\s*(?:Economic Times|ET|TechCrunch|Moneycontrol|Inc42|YourStory|Business Standard|Mint|LiveMint|Reuters|Bloomberg|CNBC|VCCircle|Entrackr|Business Today|Financial Express|TOI|Times of India|Hindu|NDTV|Forbes|The Ken|Morning Context|Hindustan Times|Business Insider|TechRadar|Startup Story|BW|BW Businessworld)\s*$/i, '');

  // Pattern: first capitalized multi-word entity before a verb
  // "Razorpay raises $500M" → "Razorpay"
  // "Fintech startup Paytm appoints new CEO" → "Paytm"
  const patterns = [
    // "X raises/secures/gets/announces"
    /^(.+?)\s+(?:raises?|secures?|gets?|announces?|launches?|acquires?|partners?|expands?|plans?|opens?|hires?|appoints?|names?|shuts?|closes?|lays?)\b/i,
    // "startup X raises" or "company X raises"
    /\b(?:startup|company|firm|brand|platform|app)\s+([A-Z][\w.]+(?:\s+[A-Z][\w.]+)?)\s+/,
    // First proper noun
    /^([A-Z][\w.]+(?:\s+[A-Z][\w.]+){0,2})/,
  ];

  for (const re of patterns) {
    const m = re.exec(clean);
    if (m) {
      let name = m[1].trim()
        .replace(/^(?:Indian|Global|New|The|How|Why|This|After|Before|While)\s+/i, '')
        .replace(/\s+(?:startup|company|firm|brand|platform|'s)$/i, '')
        .trim();
      // Must start with capital and be reasonable length
      if (name.length >= 2 && name.length <= 50 && /^[A-Z]/.test(name)) {
        return name;
      }
    }
  }

  return null;
}

// ── Country detection ─────────────────────────────────────────────────────

const COUNTRY_PATTERNS = [
  { re: /\b(?:India|Indian|Mumbai|Delhi|Bengaluru|Bangalore|Hyderabad|Chennai|Pune|Kolkata|Gurugram|Gurgaon|Noida|Ahmedabad|Jaipur)\b/i, country: 'India' },
  { re: /\b(?:United States|US|USA|American|Silicon Valley|New York|San Francisco|California|Seattle|Boston|Austin|Chicago)\b/i, country: 'US' },
  { re: /\b(?:United Kingdom|UK|British|London|Manchester|Edinburgh)\b/i, country: 'UK' },
  { re: /\b(?:Singapore|Singaporean)\b/i, country: 'Singapore' },
  { re: /\b(?:Dubai|UAE|Abu Dhabi|Emirates)\b/i, country: 'UAE' },
  { re: /\b(?:China|Chinese|Beijing|Shanghai|Shenzhen)\b/i, country: 'China' },
  { re: /\b(?:Japan|Japanese|Tokyo)\b/i, country: 'Japan' },
  { re: /\b(?:Germany|German|Berlin|Munich)\b/i, country: 'Germany' },
  { re: /\b(?:France|French|Paris)\b/i, country: 'France' },
  { re: /\b(?:Australia|Australian|Sydney|Melbourne)\b/i, country: 'Australia' },
  { re: /\b(?:Canada|Canadian|Toronto|Vancouver)\b/i, country: 'Canada' },
  { re: /\b(?:Israel|Israeli|Tel Aviv)\b/i, country: 'Israel' },
  { re: /\b(?:Indonesia|Indonesian|Jakarta)\b/i, country: 'Indonesia' },
  { re: /\b(?:Brazil|Brazilian|Sao Paulo)\b/i, country: 'Brazil' },
  { re: /\b(?:South Korea|Korean|Seoul)\b/i, country: 'South Korea' },
  { re: /\b(?:Nigeria|Nigerian|Lagos)\b/i, country: 'Nigeria' },
  { re: /\b(?:Kenya|Kenyan|Nairobi)\b/i, country: 'Kenya' },
  { re: /\b(?:Southeast Asia|SE Asia|SEA)\b/i, country: 'Southeast Asia' },
];

function extractCountry(text) {
  for (const { re, country } of COUNTRY_PATTERNS) {
    if (re.test(text)) return country;
  }
  return null;
}

// ── Category mapping ──────────────────────────────────────────────────────
// Maps keywords found in headlines to HarvinAI DB categories

const CATEGORY_KEYWORDS = [
  { keywords: /\b(?:fintech|neobank|UPI|payment[s]?|lending|loan|credit\s*card|digital\s*bank|BNPL|buy\s*now\s*pay\s*later)\b/i, category: 'FinTech' },
  { keywords: /\b(?:edtech|ed-?tech|online\s*learning|e-?learning|skill|upskill|LMS|coaching|tutoring)\b/i, category: 'EdTech' },
  { keywords: /\b(?:ecommerce|e-?commerce|D2C|direct.to.consumer|online\s*(?:shop|store|retail)|marketplace)\b/i, category: 'Ecommerce/Retail' },
  { keywords: /\b(?:SaaS|B2B\s*(?:software|platform)|enterprise\s*software|cloud\s*software)\b/i, category: 'SaaS & B2B' },
  { keywords: /\b(?:health\s*tech|healthtech|telemedicine|telehealth|digital\s*health|medtech|medical\s*device)\b/i, category: 'Health & Wellness' },
  { keywords: /\b(?:pharma|pharmaceutical|drug|biotech|biotechnology|clinical\s*trial)\b/i, category: 'Pharmaceuticals' },
  { keywords: /\b(?:food\s*(?:tech|delivery)|cloud\s*kitchen|QSR|quick\s*service\s*restaurant|ghost\s*kitchen|meal\s*kit)\b/i, category: 'Food Delivery' },
  { keywords: /\b(?:food|beverage|snack|dairy|FMCG|consumer\s*goods|packaged\s*food)\b/i, category: 'Food & Beverage' },
  { keywords: /\b(?:grocery|supermarket|kirana|quick\s*commerce|q-?commerce|instant\s*delivery)\b/i, category: 'Grocery & Supermarket' },
  { keywords: /\b(?:fashion|apparel|clothing|garment|footwear|shoe|textile|D2C\s*fashion|ethnic\s*wear)\b/i, category: 'Fashion & Apparel' },
  { keywords: /\b(?:beauty|skincare|cosmetic|personal\s*care|grooming|makeup|haircare)\b/i, category: 'Beauty & Personal Care' },
  { keywords: /\b(?:jewel|diamond|gold|silver|gemstone|ornament)\b/i, category: 'Jewelry' },
  { keywords: /\b(?:logistics|supply\s*chain|warehousing|last\s*mile|freight|shipping|3PL|fulfillment)\b/i, category: 'Logistics' },
  { keywords: /\b(?:EV|electric\s*vehicle|auto|automotive|car|motor|two-?wheeler|scooter|bike\s*taxi)\b/i, category: 'Automotive' },
  { keywords: /\b(?:real\s*estate|proptech|prop-?tech|property|housing|construction|infra|cement|steel)\b/i, category: 'Real Estate' },
  { keywords: /\b(?:AI|artificial\s*intelligence|machine\s*learning|ML|generative\s*AI|gen\s*AI|LLM|deep\s*learning|NLP)\b/i, category: 'AI & Data Science' },
  { keywords: /\b(?:gaming|esport|game\s*studio|mobile\s*game|video\s*game)\b/i, category: 'Gaming & Esports' },
  { keywords: /\b(?:crypto|blockchain|web3|DeFi|NFT|token|bitcoin|ethereum)\b/i, category: 'Crypto & Web3' },
  { keywords: /\b(?:insur(?:ance|tech)|life\s*insurance|health\s*insurance|general\s*insurance)\b/i, category: 'Insurance' },
  { keywords: /\b(?:travel|hotel|hospitality|OTA|online\s*travel|booking|tourism|airline|aviation|flight)\b/i, category: 'Travel & Ticketing' },
  { keywords: /\b(?:agri(?:tech|culture)|farm(?:ing|tech)|crop|seed|harvest|agriculture)\b/i, category: 'Agriculture' },
  { keywords: /\b(?:clean\s*(?:tech|energy)|solar|wind|renewable|green\s*energy|EV\s*charging|climate\s*tech|sustainability)\b/i, category: 'Energy & Utilities' },
  { keywords: /\b(?:cyber\s*security|cybersecurity|infosec|data\s*protection|security\s*platform)\b/i, category: 'Cybersecurity' },
  { keywords: /\b(?:HR\s*tech|hrtech|recruitment|hiring\s*platform|talent|staffing|workforce)\b/i, category: 'HR & Recruitment' },
  { keywords: /\b(?:media|OTT|streaming|entertainment|content|creator|influencer|podcast|music|audio)\b/i, category: 'Media & Entertainment' },
  { keywords: /\b(?:banking|bank|NBFC|microfinance|deposit|savings|wealth\s*management)\b/i, category: 'Banking & Financial Services' },
  { keywords: /\b(?:social\s*media|social\s*platform|dating|community\s*platform|social\s*network)\b/i, category: 'Social Media & Platforms' },
  { keywords: /\b(?:robot|robotics|automation|drone|IoT|connected\s*device|industrial\s*IoT)\b/i, category: 'Robotics & Automation' },
  { keywords: /\b(?:semiconductor|chip|chipset|processor|fab|foundry)\b/i, category: 'Semiconductor & Chips' },
  { keywords: /\b(?:cloud|DevOps|DevTool|infrastructure|data\s*center|hosting|server|CDN)\b/i, category: 'Cloud & DevTools' },
  { keywords: /\b(?:pet|pet\s*care|veterinar|animal\s*health)\b/i, category: 'Pet Products' },
  { keywords: /\b(?:baby|kids|childcare|parenting|maternity)\b/i, category: 'Baby & Kids' },
  { keywords: /\b(?:fitness|gym|workout|sports|outdoor|athleisure)\b/i, category: 'Fitness & Gym' },
  { keywords: /\b(?:home|furniture|decor|interior|mattress|kitchenware|appliance)\b/i, category: 'Home & Living' },
  { keywords: /\b(?:coworking|co-?working|managed\s*office|flexible\s*workspace)\b/i, category: 'Coworking & Office Space' },
  { keywords: /\b(?:legal\s*tech|legaltech|contract|compliance\s*platform)\b/i, category: 'Legal' },
  { keywords: /\b(?:telecom|5G|broadband|ISP|connectivity)\b/i, category: 'Telecom' },
  { keywords: /\b(?:fantasy\s*sport|betting|gambling|casino|lottery|prediction\s*market)\b/i, category: 'Betting & Fantasy Sports' },
  { keywords: /\b(?:space|satellite|aerospace|defense|defence|rocket|launch\s*vehicle)\b/i, category: 'Aerospace & Defense' },
  { keywords: /\b(?:manufacturing|factory|industrial|packaging|printing)\b/i, category: 'Manufacturing' },
  { keywords: /\b(?:salon|spa|wellness|ayurved|yoga)\b/i, category: 'Salon & Spa' },
  { keywords: /\b(?:subscription|rental|rent|lease)\b/i, category: 'Rental & Subscription Services' },
  { keywords: /\b(?:wedding|event|celebration|cater)\b/i, category: 'Wedding & Events' },
  { keywords: /\b(?:electronics|gadget|smartphone|laptop|wearable|smartwatch|consumer\s*tech)\b/i, category: 'Electronics & Tech' },
  { keywords: /\b(?:AR|VR|metaverse|virtual\s*reality|augmented\s*reality|mixed\s*reality)\b/i, category: 'AR / VR & Metaverse' },
  { keywords: /\b(?:quantum\s*computing|quantum\s*tech)\b/i, category: 'Quantum Computing' },
];

function extractCategory(text) {
  for (const { keywords, category } of CATEGORY_KEYWORDS) {
    if (keywords.test(text)) return category;
  }
  return null;
}

// ── Market impact assessment ──────────────────────────────────────────────

function assessMarketImpact(newsType, amountUSD, text) {
  // High impact: large funding, IPO, major acquisition, large layoffs, regulatory bans
  if (newsType === 'funding' && amountUSD && amountUSD >= 50) return 'high';
  if (newsType === 'funding' && /\bIPO\b/.test(text)) return 'high';
  if (newsType === 'acquisition' && amountUSD && amountUSD >= 100) return 'high';
  if (newsType === 'shutdown' && /\b(?:shuts?\s*down|bankrupt|insolvency|liquidat)\b/i.test(text)) return 'high';
  if (newsType === 'shutdown' && /\b\d{3,}/.test(text)) return 'high'; // 100+ layoffs
  if (newsType === 'regulatory' && /\b(?:ban|block|restrict|revoke|suspend)\b/i.test(text)) return 'high';

  // Medium
  if (newsType === 'funding' && amountUSD && amountUSD >= 5) return 'medium';
  if (newsType === 'hiring' && /\b(?:CEO|CTO|CFO|COO)\b/.test(text)) return 'medium';
  if (newsType === 'acquisition') return 'medium';
  if (newsType === 'expansion') return 'medium';

  return 'low';
}

// ── Blacklist: skip irrelevant articles ───────────────────────────────────

const SKIP_PATTERNS = [
  /\b(?:stock\s*(?:price|tip|pick|market|trading)|share\s*(?:price|market)|sensex|nifty|BSE|NSE)\b/i,
  /\b(?:mutual\s*fund|SIP|investment\s*tip|portfolio\s*advice|personal\s*finance)\b/i,
  /\b(?:cricket|football|soccer|tennis|IPL|FIFA|Olympics|World\s*Cup)\b/i,
  /\b(?:weather|forecast|temperature|rain|monsoon|cyclone)\b/i,
  /\b(?:movie|film\s*review|box\s*office|trailer|bollywood|hollywood|song|album)\b/i,
  /\b(?:election|poll|political|parliament|minister|president|prime\s*minister)\b/i,
  /\b(?:horoscope|zodiac|astrology)\b/i,
  /\b(?:recipe|cooking|kitchen\s*tip)\b/i,
];

function shouldSkip(text) {
  return SKIP_PATTERNS.some(re => re.test(text));
}

// ── Main extraction function ──────────────────────────────────────────────

/**
 * Extract structured market news data from an article using ONLY regex.
 * No API calls needed.
 *
 * @param {Object} article - {title, snippet, url, pubDate, source}
 * @returns {Object|null} Extracted data or null if not relevant
 */
function extractMarketNews(article) {
  const text = `${article.title} ${article.snippet || ''}`;

  // Skip irrelevant articles
  if (shouldSkip(text)) return null;

  // Detect news type
  let newsType = null;
  let confidence = 0;

  for (const { type, patterns, confidence: baseConf } of NEWS_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        newsType = type;
        confidence = baseConf;
        break;
      }
    }
    if (newsType) break;
  }

  if (!newsType) return null;

  // Extract company name
  const companyName = extractCompanyName(article.title);

  // Extract category
  const category = extractCategory(text);

  // Extract country
  const country = extractCountry(text);

  // Type-specific data extraction
  const details = {};

  if (newsType === 'funding') {
    const { amount, amountUSD } = extractAmount(text);
    details.amount = amount;
    details.amountUSD = amountUSD;
    details.round = extractRound(text);
    details.investors = extractInvestors(text);
  }

  if (newsType === 'hiring') {
    const hiring = extractHiringData(text);
    details.person = hiring.person;
    details.role = hiring.role;
    details.roleLevel = hiring.roleLevel;
    details.hiringCount = hiring.hiringCount;
  }

  if (newsType === 'acquisition') {
    const acq = extractAcquisitionData(text);
    details.acquirer = acq.acquirer;
    details.target = acq.target;
    details.dealAmount = acq.dealAmount;
  }

  if (newsType === 'launch' || newsType === 'expansion') {
    const market = text.match(/\b(?:in|into|across)\s+(India|US|UK|Europe|Southeast\s*Asia|Middle\s*East|Africa|Asia|Global|Latin\s*America|APAC)\b/i);
    details.market = market ? market[1] : null;
    const product = text.match(/\b(?:launch(?:es|ed)?|unveil[s]?|introduc(?:e[sd]?|ing)|roll[s]?\s*out)\s+(?:(?:new|its|a|the)\s+)?([A-Z][\w\s]+?)(?:\s+(?:in|for|to|across|,|$))/i);
    details.productName = product ? product[1].trim().slice(0, 60) : null;
  }

  if (newsType === 'partnership') {
    const partner = text.match(/\b(?:partners?\s*with|ties?\s*up\s*with|collaborat\w+\s*with|signs?\s*(?:deal|agreement|MOU)\s*with)\s+([A-Z][\w\s&'.]+?)(?:\s+(?:to|for|in|,|\.|$))/i);
    details.partner = partner ? partner[1].trim().slice(0, 60) : null;
  }

  if (newsType === 'regulatory') {
    const regulator = text.match(/\b(RBI|SEBI|TRAI|CCI|FSSAI|DPIIT|Government|Ministry\s+of\s+\w+|Supreme\s+Court|High\s+Court)\b/i);
    details.regulator = regulator ? regulator[1] : null;
    details.impact = /\b(?:ban|block|restrict|revoke|suspend|penalty|fine|crackdown)\b/i.test(text) ? 'negative'
      : /\b(?:approve|clear|green.?light|permit|relax|ease|allow)\b/i.test(text) ? 'positive' : 'neutral';
  }

  if (newsType === 'shutdown') {
    const reason = text.match(/\b(?:due\s*to|because\s*of|amid|over|citing)\s+(.+?)(?:\.|,|$)/i);
    details.reason = reason ? reason[1].trim().slice(0, 100) : null;
    const impacted = text.match(/\b(\d[\d,]*)\s*(?:employee|worker|staff|people|job)/i);
    details.impactedCount = impacted ? parseInt(impacted[1].replace(/,/g, ''), 10) : null;
  }

  const marketImpact = assessMarketImpact(newsType, details.amountUSD, text);

  // Build summary from headline
  const summary = article.title
    .replace(/\s*[-–|]\s*(?:Economic Times|ET|TechCrunch|Moneycontrol|Inc42|YourStory|Business Standard|Mint|LiveMint|Reuters|Bloomberg|CNBC|VCCircle|Entrackr|Business Today|Financial Express).*$/i, '')
    .trim();

  return {
    newsType,
    companyName,
    category,
    headline: summary.slice(0, 120),
    summary,
    country,
    marketImpact,
    confidence,
    details,
  };
}

module.exports = { extractMarketNews, extractAmount, extractRound, extractInvestors, extractCompanyName, extractCategory, extractCountry };
