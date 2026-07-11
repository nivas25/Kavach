const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY_1}`);
    const data = await response.json();
    console.log("Available Models:");
    data.models.forEach(m => console.log(m.name));
  } catch (e) {
    console.error("Error fetching models:", e);
  }
}

listModels();
