# Counterfolk

**English** · [简体中文](README.zh-CN.md)

**An open-source market simulator for testing products before launch and calibrating predictions with real-world pilots.**

Counterfolk takes its name from *counterfactual* and *folk*. Product teams can compare offers, see how different shoppers discover and choose products, and check the predictions against real-world results.

[Live demo](https://romanagent.github.io/Counterfolk/) · [Project roadmap (Chinese)](docs/PLAN.md) · [Commerce workspace plan (Chinese)](docs/plans/2026-11-21-gitnexus-plan-living-commerce-workspace.md)

## Quick start

Requires Node.js 20 or later. No dependency installation is needed.

```sh
npm run dev
```

Open the [local Counterfolk console](http://127.0.0.1:4177). It runs a demo on startup. Set `COUNTERFOLK_PORT` to use a different local port.

```sh
npm test
npm run benchmark
```

## Commerce workspace

- **Marketplaces** include two original storefronts, Global Marketplace (`环球货架`) and Domestic Retail (`星选自营`). Browse recommendations, search the catalog, check seller and stock information, view product media, and complete a simulated checkout. Orders placed in visitor preview stay in the current session. The offline view opens a 3D storefront.
- **Residents** contains 100 persistent synthetic residents across five markets. The first visit seeds three simulated days. Select a resident to view today's activity, a specific day, or their full history. Shopping events link to the corresponding product. Advance by one day, seven days, or use automatic advancement while the page is visible.
- **Products** accepts a PNG, JPEG, or WebP image up to 8 MB, plus product details and marketplace selections. It creates three A+ listing images, social copy, and a roughly 15-second vertical video. A configured AI model writes the copy and storyboard, and the browser renders the media from the uploaded image. Video export takes about 15 seconds and uses MP4 or WebM, depending on browser support. When a model is unavailable, assets are labeled as locally generated templates.
- **Listings and results** appear in preview immediately. Starting on the next simulated day, products enter the selected marketplaces' regular catalog ranking. The product dashboard shows unique residents reached, product views, cart additions, payments, refunds, and net revenue. Results can be reviewed by marketplace, discovery channel, and day. Events link back to residents. Post-exposure conversion divides unique buyers by unique residents reached. Overall conversion divides unique buyers by residents eligible for the selected marketplace or marketplaces.
- **Storage** uses IndexedDB in the current browser for persistent residents, daily events, and product media. The app remembers the selected model provider, model, and endpoint. Temporary API keys are used for requests. Resident behavior and purchases are simulated by a reproducible rules engine.

Shopping journeys draw on the [smart hardware consumer journey and channel map (Chinese)](docs/SMART_HARDWARE_SALES_PATHS.md). The browser exports video with [Canvas media capture](https://www.w3.org/TR/mediacapture-fromelement/) and [MediaRecorder](https://www.w3.org/TR/mediastream-recording/).

## From simulation to real-world pilots

1. **Configure an experiment.** In the separate A/B tool, choose a primary event such as hardware purchase, app install, activation, or payment. Configure 100 to 100,000 synthetic residents, along with markets, languages, cultural preferences, and shopper segments. Set the price, e-commerce shipping fee for hardware, product appeal, localization, and channel for each variant.
2. **Explore the neighborhood and funnel.** In Offline Marketplace (`线下平台`), switch markets, variants, or time. Run the store demo (`运行门店示例`) to replay store visits, browsing, and purchases, or choose a resident from the sample. A browser worker generates the daily counts and resident events for each market. Three.js renders the neighborhood and animates the replay.
3. **Freeze the prediction.** In Experiments (`实验管理`), enter the creative versions, assignment details, and whether conversion uses assigned or exposed users as the denominator. Lock the experiment definition (`锁定口径`) and export the workbench package to save the creative, rules engine version, seed, and aggregate prediction. If you run the AI-assisted experiment, export again to save the hybrid prediction and recorded model decisions.
4. **Compare against a small pilot.** In Pilot Calibration (`试点校准`), export the matching pilot JSON template. Fill in deduplicated real A/B counts for assigned users, exposures, and conversions, then import the file. The report checks the metric, observation window, creative versions, and channels. It shows both conversion rates, the B − A difference, the first funnel stage outside tolerance, and a pilot interval when available. The workspace includes a labeled synthetic example.
5. **Calibrate future predictions.** Import a separate set of historical pilots as CSV to fit adjustments by group. Evaluate them on held-out experiments before freezing the next prediction. Use the real pilot results to decide whether to expand the rollout.

A workbench package can be opened on another device to review its frozen prediction or replay recorded AI decisions. The main dashboard reports post-exposure conversion. Real-pilot comparisons use eligible assigned users by default, which accounts for variants that change who gets exposed. Comparisons with exposure-based denominators, nonrandomized assignments, or assignment by store or time block report descriptive differences.

## Configure a local or cloud model

Start the local server with `npm run dev`. Open Resident AI Experiments (`居民 AI 实验`) under Experiments (`实验管理`), choose a provider and model, set the number of parallel requests and the total request limit per run, and test the connection. The product upload form also has AI settings (`AI 素材设置`) for generating marketing assets.

| Provider | Setup |
| --- | --- |
| Ollama | Start Ollama locally and download a model. The default endpoint is `http://127.0.0.1:11434`. Enter the model ID shown in Ollama. |
| OpenAI | Select OpenAI and enter a model ID. Supply a temporary API key in the UI or set `COUNTERFOLK_OPENAI_API_KEY` or `OPENAI_API_KEY` before starting the server. |
| OpenAI-compatible | Enter the base URL for a local compatible service, such as `http://127.0.0.1:1234/v1`. To use a specific remote HTTPS endpoint, set `COUNTERFOLK_COMPATIBLE_URL` and optionally `COUNTERFOLK_COMPATIBLE_API_KEY` on the server. |

Lock the product copy for both variants before starting an interview. Sampled interviews record what residents understood and why. Hybrid mode adjusts the probability of considering a product for sampled residents with a valid A/B response pair. Unpaired cases use the rules baseline. The dashboard shows sample coverage, failed requests, and how many residents changed funnel stages. The model receives each variant separately and reuses one assessment when the A/A materials are identical.

The local server listens on loopback. For resident experiments, requests send the locked product materials and synthetic resident profiles to the selected provider. Temporary credentials are used for the request and excluded from workbench exports. The public demo supports rules-based experiments, the 3D neighborhood, and imported pilot comparisons. Model calls use the local server.

## Calibration CSV format

Each row represents a historical experiment, variant, and group. The results export provides `exposed` and `converted` counts for each variant and group. A labeled synthetic example is available in the UI.

```csv
experimentId,variant,split,metric,days,channel,region,segment,simulatedExposed,simulatedConverted,realExposed,realConverted
pilot-01,a,train,purchase,14,ecommerce,all,all,7200,500,1280,72
pilot-02,a,holdout,purchase,14,ecommerce,all,all,8100,560,1540,86
```

- Use `a` or `b` for `variant` and `train` or `holdout` for `split`. Assign each experiment to a single split.
- Use `purchase`, `install`, `activation`, or `paid` for `metric` and `ecommerce` or `retail` for `channel`. Use the region and segment IDs from the results export or `all` for a combined group. Rows for the same experiment, variant, and measurement scope must be mutually exclusive.
- Match the pilot population to the simulation by event, observation window, channel, country, and shopper segment. Check comparability if languages, cultural preferences, or population mixes differ.
- Calibration fits a regularized log-odds shift per group. It compares error before and after calibration on the same matched holdout rows, weighted by real exposures. Groups without matching training data display the original results.

## A/B model and data

- The simulation generates residents from a random seed. Cultural preferences are sampled independently of nationality. Budgets, needs, and channel preferences use synthetic priors, and experiment currencies use fixed conversion ratios.
- Each variant records the first channel contact in the observation window and the furthest funnel stage reached. App stages are attributed to the day of first exposure, and each first-exposure day forms a separate trend cohort. Conversion divides selected events by exposed residents.
- A browser worker runs the simulation. The current rules configuration, the last ten rules-based runs, and calibration CSV data are stored in the browser. Export workbench packages, model decisions, and pilot data to retain them separately.
- Simulation intervals reflect sampling variation within the model. Real-world pilots test how well predictions transfer. Each A/B prediction covers a single experiment. The [roadmap (Chinese)](docs/PLAN.md) covers continuous schedules, calibratable travel and inventory constraints, social networks, and persistent state across experiments.

The map uses [public-domain Natural Earth data](https://www.naturalearthdata.com/about/terms-of-use/). The 3D neighborhood uses [Three.js r187](vendor/three/README.md). Counterfolk is released under the [MIT License](LICENSE).
