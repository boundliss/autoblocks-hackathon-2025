'use client'
import Image from "next/image";
import OpenAI from "openai";
import { ResponseInput } from "openai/resources/responses/responses.js";
import { useState } from "react";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

async function getWeather(latitude: number, longitude: number) {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`);
    const data = await response.json();
    return data.current.temperature_2m;
}

const tools = [{
    type: "function" as const,
    name: "get_weather",
    description: "Get IDs of grocery items.",
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

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const [loading,setLoading] = useState<boolean>(false);
  const [conversationHistory, updateConversationHistory] = useState<any[]>([
    {
        role: "system",
        content: "you are a nutrition coach making a 3-day meal plan"
    },
    {
      role: 'assistant',
      content: "Hi! What meals would you like to eat this week??"
  }
  ]);

  async function askQuestion(question: string) {
    console.log('test')
    setLoading(true)
    updateConversationHistory(prevState => [
      ...prevState,
      {
        role: 'user',
        content: question
      }
    ]);
    setInputValue(''); // Clear the input after sending
    
    try {
      // Create conversation history for API call
      const currentHistory = [...conversationHistory, { role: 'user', content: question }];
      
      const response = await openai.responses.create({
        model: "gpt-4.1",
        input: currentHistory,
        tools,
      });

      // Loop to handle multiple tool calls
      let currentResponse = response;
      let hasMoreToolCalls = true;
      let updatedHistory = [...currentHistory];

      while (hasMoreToolCalls) {
        const toolCall = currentResponse.output[0];
        
        if (toolCall.type === 'message') {
          // Add the final message to conversation history
          updateConversationHistory(prevState => [
            ...prevState,
            {
              role: 'assistant',
              content: toolCall.content[0].text
            }
          ]);
          hasMoreToolCalls = false;
        } else if (toolCall.type === 'function_call') {
          // Add the function call to conversation history
          updateConversationHistory(prevState => [
            ...prevState,
            {
              role: 'function_call',
              content: `Called ${toolCall.name} with ${toolCall.arguments}`,
              call_id: toolCall.call_id
            }
          ]);
          
          if (toolCall.name === 'get_weather') {
            const args = JSON.parse(toolCall.arguments);
            const result = await getWeather(args.latitude, args.longitude);
            
            // Add the function result to conversation history
            updateConversationHistory(prevState => [
              ...prevState,
              {
                role: 'function_result',
                content: `Weather result: ${result}°C`,
                output: result.toString()
              }
            ]);
            
            // Update the history for the next API call
            updatedHistory.push(toolCall);
            updatedHistory.push({
              type: "function_call_output",
              call_id: toolCall.call_id,
              output: result.toString()
            });
            
            // Continue the conversation with the function result
            currentResponse = await openai.responses.create({
              model: "gpt-4.1",
              input: updatedHistory,
              tools,
            });
          }
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      updateConversationHistory(prevState => [
        ...prevState,
        {
          role: 'assistant',
          content: "Sorry, I encountered an error. Please try again."
        }
      ]);
      setLoading(false)
    }
  }
  
  return (
    <div className="">
      {conversationHistory.map((item, index) => (
        <div key={index}>
          <p><b>{item.role}</b>: {item.content}</p>
        </div>
      ))}
      <input 
        type="text" 
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && askQuestion(inputValue)}
        placeholder="Type your question here..."
        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {!loading && <button
        onClick={() => askQuestion(inputValue)} 
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 hover:scale-105 transition-all duration-200 ease-in-out shadow-md hover:shadow-lg ml-2"
      >
        Ask
      </button>}
    </div>
  );
}
