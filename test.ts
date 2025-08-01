import { OpenAI } from "openai";
import 'dotenv/config';
import { Response, ResponseInput, ResponseOutputMessage } from "openai/resources/responses/responses.mjs";


const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

async function getWeather(latitude, longitude) {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`);
    const data = await response.json();
    return data.current.temperature_2m;
}
const tools = [{
    type: "function" as const,
    name: "get_weather",
    description: "Get current temperature for provided coordinates in celsius.",
    parameters: {
        type: "object",
        properties: {
            latitude: { type: "number" },
            longitude: { type: "number" }
        },
        required: ["latitude", "longitude"],
        additionalProperties: false
    },
    strict: true
}];

const input : ResponseInput= [
    {
        role: "user",
        content: "what's the weather like in new york today?"
    },
    // {
    //     role: "user",
    //     content: "why's the sky blue?"
    // },
    {
        role: "system",
        content: "you are a pirate use pirate vernacular when answering questions"
    }
];

// Track complete conversation history
const conversationHistory: ResponseInput = [...input];

console.log("Initial input:", conversationHistory);

const response: Response = await openai.responses.create({
    model: "gpt-4.1",
    input,
    tools,
});

// Loop to handle multiple tool calls
let currentResponse = response;
let hasMoreToolCalls = true;

while (hasMoreToolCalls) {
    const toolCall = currentResponse.output[0];
    
    if (toolCall.type === 'message') {
        console.log(toolCall.content[0]);
        // Add the final message to conversation history
        conversationHistory.push(toolCall);
        hasMoreToolCalls = false; // No more tool calls, conversation is complete
    } else if (toolCall.type === 'function_call') {
        if (toolCall.name === 'get_weather') {
            const args = JSON.parse(toolCall.arguments);
            const result = await getWeather(args.latitude, args.longitude);
            
            // Add function call and result to conversation history
            conversationHistory.push(toolCall);
            conversationHistory.push({
                type: "function_call_output",
                call_id: toolCall.call_id,
                output: result.toString()
            });
            
            // Continue the conversation with the function result
            currentResponse = await openai.responses.create({
                model: "gpt-4.1",
                input: conversationHistory,
                tools,
            });
        }
    }
}

console.log("Complete conversation history:", conversationHistory);
