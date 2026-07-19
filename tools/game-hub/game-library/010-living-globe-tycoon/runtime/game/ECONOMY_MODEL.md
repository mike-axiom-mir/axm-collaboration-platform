# Causal economy model — v0.4 economy retained under the v0.10 build

## Purpose

This deterministic gameplay model answers three useful questions: **what physically exists, why did its price move, and who received the money?** It remains compact enough for a casual stewardship game. All values are fictional island units and civic credits (`¤`), not real prices, advice or forecasts.

## Accounting boundaries

1. Typed products are conserved: production, processing, sale, startup and construction each create ledger transactions.
2. Private wages, product sales, profit and business capital are not treasury money.
3. Treasury funds receive only named taxes, duties, fees and declared public ownership shares.
4. Civic materials, energy and water are separate public stocks. Typed products are private market inventory.
5. A construction application deducts each civic and typed input once, and pays the typed procurement from public funds into private capital.
6. A sector may have gross revenue while contributing only a named fraction to treasury funds.
7. Empty shelves record shortfall; they never count as a sale.
8. Typed external trade is disconnected. A trade-ready lot is inventory above reserve, not an export or receipt.

## Typed products

| Stage | Products |
|---|---|
| Raw | crops, fish, timber, clay, stone, ore |
| Intermediate | lumber, bricks, metal parts, textiles, preserved food |
| Finished | tools, machinery, furniture, household goods, construction kits |

Every product stores its unit, reference price, current stock, capacity, current price, quarter production/consumption and shortfall. The ledger is capped at 600 transactions; product price and quarter histories are also bounded.

### Recipes

Representative full-batch recipes are:

| Enterprise | Inputs | Output |
|---|---|---|
| Sawmill | 2 timber | 1.55 lumber |
| Brickworks | 2 clay + 0.35 stone | 1.85 bricks |
| Metalworks | 1.5 ore | 0.92 metal parts |
| Textile workshop | 1.5 crops | 0.82 textiles |
| Cannery | 0.9 fish + 0.7 crops + 0.12 metal parts | 1.45 preserved food |
| Toolworks | 0.7 metal parts + 0.35 lumber | 0.58 tools |
| Machinery shop | 1.2 metal parts + 0.35 tools | 0.34 machinery |
| Furniture workshop | 1.15 lumber + 0.22 textiles + 0.12 tools | 0.72 furniture |
| Construction yard | 0.9 lumber + 1.1 bricks + 0.3 metal parts | 0.82 construction kits |
| Household-goods workshop | 0.5 textiles + 0.2 metal parts | 0.62 household goods |

Actual utilization is the minimum of available inputs, energy/water factors and output capacity. Inputs and outputs scale by the same bounded batch fraction. Near-zero utilization idles a processor; no missing input is silently substituted.

Extractors use a district deposit plus energy/water where declared. Crops, fish and timber are renewable gameplay deposits affected by fertility, water, biodiversity, pollution and vegetation. Clay, stone and ore are finite compact indices.

## Product prices

The stage-specific target stock is:

```text
raw target          = capacity × 0.42
intermediate target = capacity × 0.36
finished target     = capacity × 0.30
```

For each product:

```text
scarcity = clamp((target - stock) / target, -0.90, 1.40)
demand pressure = demand > 0 ? clamp(shortfall / demand, 0, 1) : 0

price = reference × clamp(1 + scarcity × 0.72
                            + demand pressure × 0.45,
                          0.55, 2.85)
```

Thus a low stock or real unfilled order raises price; a full warehouse lowers it. Prices are signals within a bounded game range, not auction clearing.

The typed price index weights food families more heavily than building, capital and other goods. The Palace's broad food/material price cards couple public reserve scarcity with relevant typed product prices, so a healthy anonymous reserve cannot completely hide expensive bricks or scarce preserved food.

## Store demand and private finance

Population creates bounded demand for food, textiles, tools, furniture and household goods. Retail halls and island kitchens create sales channels. Supplied quantity is removed from inventory and valued at its current product price; unsupplied quantity becomes a visible shelf shortage.

```text
private profit = actual product sales
                 - recorded enterprise input/operation costs
                 - per-active-enterprise overhead

business capital next = clamp(business capital
                              + private profit × 0.44,
                              0, 500)
```

Startup firms consume declared goods and private business capital. Public construction suppliers receive 80% of the typed procurement value into business capital. Neither flow directly modifies treasury funds except through the named public accounting rules.

## Private-enterprise emergence

At most one candidate may open in an explicit quarter, and the total enterprise list is capped. A candidate must:

- fit the district's broad zone;
- clear the score threshold;
- have its startup goods in stock;
- have enough private business capital;
- not violate the local duplicate-pressure rule.

```text
score = demand/profit opportunity × 0.25
      + input or deposit supply × 0.25
      + logistics × 0.15
      + workforce × 0.10
      + zone affinity × 0.10
      + terrain/ecology × 0.10
      + seeded founder variation × 0.05
```

The full components are recorded. Supply is deliberately strong but not absolute, so a shortage can attract adaptation while terrain, access, labor and local variation keep the island from following one flat script.

## Labor and sector books

Labor force remains `round(population × 0.61)`. Formal job capacity now includes actual active/idle enterprises in addition to public services and broad zone capacity. Health and education determine bounded productivity; employment tightness and productivity influence wage. Remaining people may use a separately recorded local-livelihood capacity instead of being treated as economically nonexistent.

Agriculture revenue follows actual food/product output. Industry gross uses actual typed sales, actual input costs and only safe legacy civic-material exports. Entertainment combines stocked kitchen activity, local leisure and visitor spending. Commerce uses the margin on products actually supplied plus the small declared market base.

Visitors still respond to venues, season, roads, markets, health, biodiversity, nature and pollution. This leaves the deliberate stewardship tension: access can improve receipts while construction or industry may harm the ecology that supports appeal.

## Treasury

Named rates remain:

| Component | Rate |
|---|---:|
| Household income tax | 6% of private wages |
| Sales tax | 4% of supplied essential/leisure spending |
| Business profit tax | 14% of positive sector profit |
| Entertainment receipts tax | 10% of entertainment gross |
| Legacy civic-material export duty | 5% of actual export revenue |
| Public industry share | 32% of positive industry profit |
| Public entertainment concession | 16% of positive entertainment profit |

Commerce also pays `¤0.35` per civic market plus profit tax. Expenses include public payroll, clinic/school/utility operations, road maintenance and ecological protection.

```text
treasury net = collected named income - paid named expenses
closing funds = opening funds + treasury net
```

The older generic civic-material export remains a distinct conserved public-stock mechanism. Typed product lots never leave in v0.10.

## Typed trade readiness

For each product, stock above a protected commercial reserve becomes a lot with product ID, quantity, reserve, indicative value and `READY_NOT_EXPORTED` status. Finished goods use a lower reserve share than raw/intermediate inputs. Creating or displaying a lot changes no stock or money.

A later trade layer must still add explicit partners, route capacity, transport cost, contract terms, foreign demand/price, risk, authority and settlement transactions before any lot can leave.

## Construction

Public projects keep compact civic requirements and add a typed market bill. Examples:

| Project | Typed private bill |
|---|---|
| Housing | 1.8 lumber, 1.3 bricks, 0.2 tools |
| Clinic | 1.3 bricks, 0.7 lumber, 0.45 metal parts, 0.12 machinery |
| School | 1.2 bricks, 1 lumber, 0.45 furniture, 0.12 tools |
| Market | 0.7 lumber, 0.35 bricks, 0.18 metal parts, 0.1 tools |
| Water works | 1.1 bricks, 0.8 metal parts, 0.2 machinery, 0.45 construction kits |
| Solar co-op | 0.75 metal parts, 0.25 machinery, 0.45 construction kits |
| Farm | 0.4 tools, 0.35 lumber |
| Road | 1.3 stone, 1.1 bricks, 0.2 tools, 0.55 construction kits |
| Ecological buffer | 0.15 lumber, 0.08 tools |

```text
procurement = sum(typed quantity × current typed price)
crew cost = crew-quarters × current wage
subtotal = procurement + crews + price-linked equipment
           + terrain/site work + permits/design
cash cost = subtotal + 8% contingency
```

The preview separately shows civic physical requirements, every typed line and the financial components. Apply is all-or-nothing after revision and affordability revalidation.

Captured emergence does not weaken this model. A goal overlay adds preference only after ordinary zone and terrain checks; labor, civic allocation, private stock, exact typed bills and funds must still exist. Capture/application/mode decisions cost steward attention, but they never mint materials, products, structures or money.

## Known simplifications

- one abstract civic currency and island-wide product prices;
- no debt, interest, exchange rate, firm-by-firm cash account, ownership distribution or personal wealth;
- labor can move sectors within a quarter without retraining delay;
- fixed tax tuning rather than a full policy editor;
- compact deposits rather than geological quantities;
- no spoilage, product quality tiers, vehicle fleet, warehouse distance loss or shipping network;
- bounded histories for interface/audit use, not econometrics.

These limits keep the surface casual. New depth should be added only with causal tests and human playtesting.
