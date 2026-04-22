# Business Conditions Pulse

**A real-time macroeconomic dashboard that transforms 8 Federal Reserve (FRED) data series into actionable composite stress indicators for business decision-makers.**

---

## Purpose & Functionality

Business Conditions Pulse aggregates live economic data from the Federal Reserve Bank of St. Louis (FRED) into a single-pane-of-glass dashboard designed for rapid macro environment assessment. The tool tracks eight core indicators across four categories — **market risk** (VIX, yield curve), **financing pressure** (SOFR, high-yield credit spreads), **consumer demand** (WTI crude oil, dollar index), and **labor/inflation stress** (initial jobless claims, 5-year breakeven inflation expectations).

Raw data is normalized and weighted into four **composite stress scores** (0–100 scale) and a unified **Macro Stress Index** that instantly communicates whether the current environment is LOW, MODERATE, ELEVATED, or HIGH stress. Interactive 60-day trend charts, sparklines, and a color-coded data table provide the analytical depth needed to validate the headline numbers. Data auto-refreshes every 5 minutes during active sessions.

## Target Audience

**Who:** Small-to-mid-size business owners, CFOs, corporate treasury teams, commercial lenders, and MBA/finance students who need macro awareness but lack Bloomberg terminals or dedicated economics teams.

**How they use it:** A daily check-in tool — open the dashboard at market open, scan the composite scores for any category in the ELEVATED/HIGH range, drill into the trend charts for context, and use the signals to inform near-term decisions around inventory purchasing, debt refinancing timing, hiring plans, or capital allocation.

**Why over alternatives:** Bloomberg Terminal costs $24,000+/year. FRED's own interface requires navigating dozens of individual series pages. News-based dashboards (CNBC, MarketWatch) offer narrative, not normalized quantitative signals. Business Conditions Pulse fills the gap: it is **free, instant, and opinionated** — it doesn't just show data, it scores the environment and tells you whether to worry. No login, no paywall, no setup beyond a free API key.

## Sales Pitch & Monetization

**Value proposition:** Every delayed business decision in a deteriorating macro environment carries real cost — overpaying for inventory before a demand slowdown, locking in financing at peak rates, or expanding headcount into a weakening labor market. Business Conditions Pulse converts Federal Reserve data into a decision-support layer that saves hours of economic research per week and reduces the risk of macro-blind operational decisions.

**Monetization strategy:**

1. **Freemium SaaS** — The current open dashboard remains free as a lead generator. A paid tier ($29–99/month) adds email/SMS alerts when composite scores cross user-defined thresholds, historical backtesting of indicators, PDF report exports for board presentations, and multi-user team dashboards.

2. **API-as-a-Service** — Expose the composite scoring engine as a REST API for fintech platforms, lending software, and ERP systems that want to embed macro risk signals into their own workflows ($0.01/call or $199/month unlimited).

3. **White-label licensing** — Banks, accounting firms, and business consultancies license a branded version to distribute to their SMB clients, generating recurring revenue while deepening client engagement.

**Target buyers:** Regional banks (credit risk teams), fractional CFO firms, supply chain management platforms, and university finance programs seeking classroom-ready analytical tools.

---

*Built with React, Recharts, and the FRED API · Deployed on Vercel*
