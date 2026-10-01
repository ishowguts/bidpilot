import { Command } from 'commander';
import Table from 'cli-table3';
import { createScenario, EqualPolicy, GreedyPolicy, OraclePolicy, ThompsonPolicy, runCampaign, type ScenarioType } from '@bidpilot/core';

// Format currency
const usd = (n: number) => `$${n.toFixed(2)}`;

async function main() {
  const program = new Command();
  program
    .option('--seeds <number>', 'Number of seeds', '5')
    .option('--days <number>', 'Number of days to simulate', '30')
    .option('--scenario <type>', 'Scenario (stationary, drift, all)', 'all')
    .parse();

  const options = program.opts();
  const numSeeds = parseInt(options.seeds);
  const days = parseInt(options.days);
  const scenarios: ScenarioType[] = options.scenario === 'all' ? ['stationary', 'drift'] : [options.scenario];

  const budget = 20000;
  const splits = { software: 1, sales: 1, healthcare: 1, logistics: 1 };
  
  for (const scenarioName of scenarios) {
    console.log(`\n=== Scenario: ${scenarioName} (${numSeeds} seeds, ${days} days) ===\n`);
    
    const metrics: Record<string, { spend: number, applies: number, clicks: number }> = {
      'Equal': { spend: 0, applies: 0, clicks: 0 },
      'Greedy': { spend: 0, applies: 0, clicks: 0 },
      'Thompson': { spend: 0, applies: 0, clicks: 0 },
      'Oracle': { spend: 0, applies: 0, clicks: 0 }
    };
    
    for (let s = 1; s <= numSeeds; s++) {
      const seed = s * 1000;
      
      const scenarioEqual = createScenario(scenarioName);
      const resEqual = runCampaign(scenarioEqual, new EqualPolicy(), days, budget, splits, seed);
      metrics['Equal'].spend += resEqual.totalSpend;
      metrics['Equal'].applies += resEqual.totalApplies;
      metrics['Equal'].clicks += resEqual.totalClicks;
      
      const scenarioGreedy = createScenario(scenarioName);
      const resGreedy = runCampaign(scenarioGreedy, new GreedyPolicy(), days, budget, splits, seed);
      metrics['Greedy'].spend += resGreedy.totalSpend;
      metrics['Greedy'].applies += resGreedy.totalApplies;
      metrics['Greedy'].clicks += resGreedy.totalClicks;
      
      const scenarioThompson = createScenario(scenarioName);
      const resThompson = runCampaign(scenarioThompson, new ThompsonPolicy(), days, budget, splits, seed);
      metrics['Thompson'].spend += resThompson.totalSpend;
      metrics['Thompson'].applies += resThompson.totalApplies;
      metrics['Thompson'].clicks += resThompson.totalClicks;
      
      const scenarioOracle = createScenario(scenarioName);
      const resOracle = runCampaign(scenarioOracle, new OraclePolicy([1,2,3,4,5,6], scenarioName), days, budget, splits, seed);
      metrics['Oracle'].spend += resOracle.totalSpend;
      metrics['Oracle'].applies += resOracle.totalApplies;
      metrics['Oracle'].clicks += resOracle.totalClicks;
    }
    
    const table = new Table({
      head: ['Policy', 'Avg Spend', 'Avg Clicks', 'Avg Applies', 'CPA'],
      style: { head: [], border: [] }
    });
    
    const rows = Object.entries(metrics).map(([name, sums]) => {
      const avgSpend = sums.spend / numSeeds;
      const avgApplies = sums.applies / numSeeds;
      const avgClicks = sums.clicks / numSeeds;
      const cpa = avgApplies > 0 ? avgSpend / avgApplies : 0;
      
      return { name, avgSpend, avgClicks, avgApplies, cpa };
    });
    
    rows.sort((a, b) => a.cpa - b.cpa);
    
    for (const row of rows) {
      table.push([
        row.name,
        usd(row.avgSpend),
        row.avgClicks.toFixed(0),
        row.avgApplies.toFixed(1),
        usd(row.cpa)
      ]);
    }
    
    console.log(table.toString());
  }
}

main().catch(console.error);
