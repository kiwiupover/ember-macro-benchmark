import { InitialRenderBenchmark, Runner } from "chrome-tracing";
import * as fs from "fs";
let browserOpts = process.env.CHROME_BIN ? {
  type: "exact",
  executablePath: process.env.CHROME_BIN
} : {
  type: "system"
};

const config: {
  servers: Array<{ name: string, port: number }>;
} = JSON.parse(fs.readFileSync("config.json", "utf8"));


let benchmarks = config.servers.map(({ name, port }) => new InitialRenderBenchmark({
  name,
  url: `http://localhost:${port}/?perf.tracing`,
  markers: [
    { start: "domLoading", label: "load" },
    { start: "beforeVendor", label: "boot" },
    { start: "willTransition", label: "transition" },
    { start: "didTransition", label: "render" }
  ],
  browser: browserOpts
}));

let runner = new Runner(benchmarks);
runner.run(10).then((results) => {
  let samplesCSV = "set,ms,type\n";
  let gcCSV = "set,heap,type\n";
  results.forEach(result => {
    let set = result.set;
    result.samples.forEach(sample => {
      samplesCSV += set + "," + (sample.compile / 1000) + ",compile\n";
      samplesCSV += set + "," + (sample.run / 1000) + ",run\n";
      samplesCSV += set + "," + (sample.js / 1000) + ",js\n";
      samplesCSV += set + "," + (sample.gc / 1000) + ",gc\n";
      samplesCSV += set + "," + (sample.duration / 1000) + ",duration\n";
      sample.gcSamples.forEach(sample => {
        gcCSV += set + "," + sample.usedHeapSizeBefore + ",before\n";
        gcCSV += set + "," + sample.usedHeapSizeAfter + ",after\n";
      });
    });
  });
  let phasesCSV = "set,phase,ms,type\n";
  results.forEach(result => {
    let set = result.set;
    result.samples.forEach(sample => {
      sample.phaseSamples.forEach(phaseSample => {
        phasesCSV += set + "," + phaseSample.phase + "," + (phaseSample.self / 1000) + ",self\n";
        phasesCSV += set + "," + phaseSample.phase + "," + (phaseSample.cumulative / 1000) + ",cumulative\n";
      });
    });
  });
  require('fs').writeFileSync('results/samples.csv', samplesCSV);
  require('fs').writeFileSync('results/gc.csv', gcCSV);
  require('fs').writeFileSync('results/phases.csv', phasesCSV);
  require('fs').writeFileSync('results/results.json', JSON.stringify(results, null, 2));
}).catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
