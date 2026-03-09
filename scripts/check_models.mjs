import { GoogleGenerativeAI } from "@google/generative-ai";

async function checkModels() {
  const apiKey = "AIzaSyAjkw7xrRzXK8644nkXoKAesQ3f4dacUDI";
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Available Models:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

checkModels();
