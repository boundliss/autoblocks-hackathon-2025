import { OpenAI } from "openai";
import 'dotenv/config';
import { Response, ResponseInput, ResponseOutputMessage } from "openai/resources/responses/responses.mjs";

// console.log('test')
// console.log(process.env.OPENAI_API_KEY)

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
        content: "What's the weather like in new york today?"
    }
];


const response: Response = await openai.responses.create({
    model: "gpt-4.1",
    input,
    tools,
});


const toolCall = response.output[0];
if (toolCall.type === 'function_call') {
    if (toolCall.name ==='get_weather') {
        const args = JSON.parse(toolCall.arguments)
        const result = await getWeather(args.latitude, args.longitude);
        input.push(toolCall);
        input.push({
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: result.toString()
        });
    }
}

const response2 = await openai.responses.create({
    model: "gpt-4.1",
    input,
    tools,
    store: true,
});

console.log(response2.output_text)