require('dotenv').config();
const { userAdvocate } = require('./src/mastra/agents/userAdvocate');

async function test() {
  console.log("Testing stream...");
  try {
    const res = await userAdvocate.stream("Say hello world in 5 words.");
    for await (const chunk of res.textStream) {
      process.stdout.write(chunk);
    }
    console.log("\nDone.");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
