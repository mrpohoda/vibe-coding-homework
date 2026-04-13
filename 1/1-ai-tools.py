import os
import json
from openai import OpenAI
from pprint import pprint
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

# define a list of callable tools for the model
tools = [
    {
        "type": "function",
        "function": {
            "name": "calculate_sum",
            "description": "Calculate sum of given numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                "number1": {
                    "type": "number",
                    "description": "A number between 1 and 1000",
                },
                "number2": {
                    "type": "number",
                    "description": "A number between 1 and 1000",
                },
            },
                "required": ["number1", "number2"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_division",
            "description": "Calculate square root of given number.",
            "parameters": {
                "type": "object",
                "properties": {
                "number1": {
                    "type": "number",
                    "description": "A number between 1 and 1000",
                },
                "number2": {
                    "type": "number",
                    "description": "A number between 1 and 1000",
                },
            },
                "required": ["number1", "number2"],
            },
        },
    }
]

# Function Implementations
def calculate_sum(number1, number2):
    return 1000 * (number1 + number2)

def calculate_division(number1, number2):
    return number1 / number2

available_functions = {
    "calculate_division": calculate_division,
    "calculate_sum": calculate_sum,
}

# Function to process messages and handle function calls
def get_completion_from_messages(messages, model="gpt-4o"):
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        tools=tools,  # Custom tools
        # tool_choice="auto"  # Allow AI to decide if a tool should be called
    )

    response_message = response.choices[0].message

    print("First response:", response_message)

    if response_message.tool_calls:
        # Find the tool call content
        tool_call = response_message.tool_calls[0]

        # Extract tool name and arguments
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments) 
        tool_id = tool_call.id
        
        # Call the function
        function_to_call = available_functions[function_name]
        function_response = function_to_call(**function_args)

        print(function_response)

        messages.append({
            "role": "assistant",
            "tool_calls": [
                {
                    "id": tool_id,  
                    "type": "function",
                    "function": {
                        "name": function_name,
                        "arguments": json.dumps(function_args),
                    }
                }
            ]
        })
        messages.append({
            "role": "tool",
            "tool_call_id": tool_id,  
            "name": function_name,
            "content": json.dumps(function_response),
        })

        # Second call to get final response based on function output
        second_response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=tools,  
            #tool_choice="auto"
        )
        final_answer = second_response.choices[0].message

        print("Second response:", final_answer)
        return final_answer

    return "No relevant function call found."

# Example usage
messages = [
    {"role": "system", "content": "You are a helpful AI assistant."},
    {"role": "user", "content": "what is the sum of numbers 5 and 11? If there is a result from my function, use that as final result."},
    # {"role": "user", "content": "what is the division of numbers 10 and 20?"},
]

response = get_completion_from_messages(messages)

print("--- Full response: ---")
pprint(response)
print("--- Response text: ---")
print(response.content)
