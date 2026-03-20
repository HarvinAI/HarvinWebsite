import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `You are HarvinAI Assistant — a navigation guide for the HarvinAI platform. Your job is to help users find where things are in the platform, NOT explain how features work internally.

## STRICT RULES
1. NEVER explain internal workings, algorithms, data sources, or technical implementation details.
2. NEVER reveal how tech scanning works, how categories are classified, how signals are sourced, or how traffic is estimated.
3. Instead, ALWAYS guide users to the right place in the platform to find what they need.
4. Keep answers to 2-3 sentences max. Be direct.
5. If a user asks "how does X work?", redirect them: "You can try it out yourself — go to [location] in the dashboard."
6. Never reveal API keys, database structure, data sources, scraping methods, or any implementation details.
7. If asked unrelated questions, say: "I can only help with navigating the HarvinAI platform. What are you looking for?"

## Platform Navigation Map

**Sidebar → Intelligence:**
- "Market Intelligence" — View live funding rounds and key hires for D2C brands
- "Account Explorer" — Browse and filter 25,000+ D2C brand accounts
- "Tech Scanner" — Enter any URL to scan its tech stack

**Sidebar → Watchlists:**
- "My Watchlists" — View and manage your saved brand lists

**Sidebar → Settings:**
- "ICP & Preferences" — Set your Ideal Customer Profile (categories, regions)
- "Integrations" — Connect external tools

**Account Explorer Filters (left panel):**
- Basics: Category, Country, State, City
- D2C Profile: Business Model, Scale (Traffic), Offline Presence, App Presence
- Tech Stack: Ecommerce Platform, Engagement/CRM, Payments
- Active Signals, Funding Stage

**Chrome Extension:**
- Install from Chrome Web Store → search "HarvinAI"
- Pin it → visit any website → click HarvinAI icon to scan

**Account Detail Page:**
- Click any brand name in Account Explorer to see full details

**Market Intelligence Tab:**
- Switch period: This Week / Last 2 Weeks / Last Month
- View signal cards grouped by type (Funding, Key Hiring)
- "Recommended This Week" section shows top-scored accounts

## Example Responses
- User: "How does tech scanning work?" → "Head to **Tech Scanner** in the sidebar, enter any URL, and see the results instantly. You can also use our **Chrome Extension** to scan any website while browsing."
- User: "Where can I find funded brands?" → "Go to **Market Intelligence** in the sidebar — you'll see recent funding rounds. You can also filter by **Active Signals → Recently Funded** in Account Explorer."
- User: "How do you detect categories?" → "You can see the category for any brand in **Account Explorer** or by scanning it with the **Tech Scanner**."
- User: "What tech stacks can you detect?" → "Try scanning any website in the **Tech Scanner** tab or use the **Chrome Extension** — you'll see all detected technologies grouped by category."`;


export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  if (!GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'Chat is not configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for common questions — instant fallback answers (no API call needed)
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const fallback = getFallbackAnswer(lastMsg);
    if (fallback) {
      return NextResponse.json({ reply: fallback }, { headers: corsHeaders });
    }

    // Keep only last 10 messages to stay within context limits
    const recentMessages = messages.slice(-10);

    const groqBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...recentMessages,
      ],
      temperature: 0.3,
      max_tokens: 500,
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(groqBody),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[chat API] Groq error:', response.status, err);
      // Try fallback model
      const fallbackReply = await tryFallbackModel(recentMessages);
      if (fallbackReply) {
        return NextResponse.json({ reply: fallbackReply }, { headers: corsHeaders });
      }
      return NextResponse.json(
        { reply: "I'm having trouble connecting right now. Here's what I can tell you: HarvinAI is a D2C brand intelligence platform — you can explore 25,000+ accounts, detect tech stacks, and track market signals. Try asking me again in a moment!" },
        { headers: corsHeaders }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply }, { headers: corsHeaders });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[chat API] error:', error?.message);
    return NextResponse.json(
      { reply: "Something went wrong on my end. Please try again — I'm here to help with anything about HarvinAI!" },
      { headers: corsHeaders }
    );
  }
}

/** Try the smaller 8b model as fallback */
async function tryFallbackModel(messages: Array<{role: string; content: string}>): Promise<string | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Instant answers for common questions — navigation-focused, no internal details */
function getFallbackAnswer(q: string): string | null {
  if (/what is harvinai|what does harvinai do|tell me about harvinai|about harvin/i.test(q)) {
    return "**HarvinAI** is a D2C Brand Intelligence Platform. Here's where to start:\n\n- **Account Explorer** (sidebar) — Browse 25,000+ brand accounts\n- **Tech Scanner** (sidebar) — Scan any website's tech stack\n- **Market Intelligence** (sidebar) — View funding & hiring signals\n- **Chrome Extension** — Scan websites while you browse";
  }
  if (/how does tech scan|how.*tech.*work|tech detection|tech stack.*work/i.test(q)) {
    return "Try it yourself! Go to **Tech Scanner** in the sidebar and enter any URL. You can also install our **Chrome Extension** from the Chrome Web Store — just visit any website and click the HarvinAI icon.";
  }
  if (/what categor|how many categor|list.*categor|categor.*support/i.test(q)) {
    return "We support **128 categories** with 920+ subcategories. You can see all categories in **Account Explorer** — click the **Category filter** in the left panel to browse the full list.";
  }
  if (/how.*signal|what.*signal|market intelligence|buying signal|funding.*signal/i.test(q)) {
    return "Go to **Market Intelligence** in the sidebar to see live funding rounds and key hires. You can filter by period (This Week / Last 2 Weeks / Last Month). The **\"Recommended This Week\"** section shows top accounts with strong recent signals.";
  }
  if (/what filter|how.*filter|filter.*available|what can i filter/i.test(q)) {
    return "Open **Account Explorer** and look at the **filter panel on the left**. You'll find filters for Category, Country, State, City, Business Model, Scale, Offline Stores, App Presence, Tech Stack, Active Signals, and Funding Stage.";
  }
  if (/what.*watchlist|how.*watchlist|create.*watchlist/i.test(q)) {
    return "In **Account Explorer**, select any brands using the checkboxes → click **\"Add to Watchlist\"**. You can view all your saved lists under **Watchlists → My Watchlists** in the sidebar.";
  }
  if (/chrome extension|browser extension|how.*install|install.*extension/i.test(q)) {
    return "Search **\"HarvinAI\"** in the Chrome Web Store and install it. Then **pin it** to your toolbar. Visit any website and click the HarvinAI icon to scan it.";
  }
  if (/pricing|cost|how much|free|plan/i.test(q)) {
    return "HarvinAI currently offers **Early Access**. Visit [harvin.ai](https://www.harvin.ai) or reach out to our team for details.";
  }
  if (/where.*fund|find.*fund|funded.*brand|recently funded/i.test(q)) {
    return "Two places to find funded brands:\n\n- **Market Intelligence** (sidebar) — shows live funding rounds\n- **Account Explorer** → filter by **Active Signals → Recently Funded** or **Funding Stage** in the left panel";
  }
  if (/where.*tech|find.*tech|which.*tech|shopify|razorpay|clevertap/i.test(q)) {
    return "Go to **Account Explorer** → open the **Tech Stack** filter in the left panel. You can filter by Ecommerce Platform (Shopify, WooCommerce), Engagement/CRM (CleverTap, MoEngage), and Payments (Razorpay, Stripe).";
  }
  if (/export|download|csv/i.test(q)) {
    return "In **Account Explorer**, click the **Export** button at the top right to download your filtered accounts as a CSV file.";
  }
  if (/how.*scan|scan.*website|analyze.*website|check.*website/i.test(q)) {
    return "Two ways to scan:\n\n- **Tech Scanner** in the sidebar — enter any URL\n- **Chrome Extension** — visit the website and click the HarvinAI icon in your toolbar";
  }
  if (/icp|ideal customer|preferences|configure/i.test(q)) {
    return "Go to **Settings → ICP & Preferences** in the sidebar to set your Ideal Customer Profile — categories, regions, and offline presence.";
  }
  if (/hi|hello|hey|good morning|good evening/i.test(q) && q.length < 20) {
    return "Hey! I'm the HarvinAI Assistant. I can help you find your way around the platform. What are you looking for?";
  }
  if (/how.*work|how do you|how does|behind the scene|algorithm|method|approach/i.test(q)) {
    return "The best way to understand is to try it! Head to the relevant section in the sidebar — **Account Explorer**, **Tech Scanner**, or **Market Intelligence** — and explore the features firsthand.";
  }
  return null;
}
