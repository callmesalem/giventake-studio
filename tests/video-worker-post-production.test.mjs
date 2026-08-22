import assert from "node:assert/strict";

const { createAssemblyPlan } = await import("../services/video-worker/src/post-production.mjs");

const job = {
  id: "job-0001",
  brand: {
    name: "GivenTake Devs",
    website: "giventakedevs.com",
    callToAction: "Book a discovery call",
  },
  storyboard: [
    { durationSeconds: 5, narration: "Stop carrying manual work." },
    { durationSeconds: 10, narration: "Give your team a clear operating system." },
    { durationSeconds: 5, narration: "Book a discovery call today." },
  ],
};

const plan = createAssemblyPlan(
  job,
  "vertical",
  ["scene-1.mp4", "scene-2.mp4", "scene-3.mp4"],
  "vertical.mp4",
);

assert.equal(plan.profile, "vertical");
assert.equal(plan.width, 1080);
assert.equal(plan.height, 1920);
assert.equal(plan.expectedDurationSeconds, 20);
assert.match(plan.concatContent, /file 'scene-1.mp4'/);
assert.match(plan.captionsContent, /00:00:00,000 --> 00:00:05,000/);
assert.match(plan.filterGraph, /subtitles=/);
assert.match(plan.filterGraph, /GivenTake Devs/);
assert.match(plan.filterGraph, /giventakedevs\.com/);
assert.match(plan.filterGraph, /Book a discovery call/);
assert.ok(plan.args.includes("-filter_complex"));
assert.throws(
  () => createAssemblyPlan(job, "vertical", ["scene-1.mp4"], "vertical.mp4"),
  /one clip/i,
);

console.log("Video worker post-production tests passed.");
