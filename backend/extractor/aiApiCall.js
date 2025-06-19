const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Use the specific Python path for intern00419
const PYTHON_PATH = 'C:\\Users\\intern00419\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

// API configuration
const API_KEY = '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';
const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'; // Correct Groq endpoint

function extractJsonFromText(text) {
    // Try to find a code block with JSON
    const codeBlockMatch = text.match(/```[\s\S]*?({[\s\S]*?})[\s\S]*?```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        try {
            return JSON.parse(codeBlockMatch[1]);
        } catch (e) {
            // If parsing fails, fall through to next method
        }
    }
    // Try to find a JSON object in the text
    const jsonMatch = text.match(/{[\s\S]*}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            // If parsing fails, return null
        }
    }
    return null;
}

async function processTextWithAI(text) {
    try {
        const requestBody = {
            model: "llama3-70b-8192",
            messages: [
                {
                    role: "system",
                    content: `You are an AI trained to analyze and structure extracted text. You now need to extract key value pairs from the 
                    given text and categrorize them into a JSON format. The text may contain various symbols,
                    white spaces, and other artifacts due to OCR extraction. Focus on identifying meaningful key-value pairs.
                    Your output should strictly only be in a json format, without any additional text or explanations.`
                },
                {
                    role: "user",
                    content: `This is my input data, it is extracted from a pdf file which is a form like bank registration form or any
                    other form. I have used ocr to extract the text from the form. Since it's ocr it may have many problems like 
                    useless symbols, white spaces and stuff at random locations.\n${text}`
                }
            ],
            temperature: 0.5,
            max_tokens: 1024
        };
        const requestHeaders = {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        };
        // Log endpoint, headers, and body
        console.log('Groq API Endpoint:', API_ENDPOINT);
        console.log('Groq API Headers:', requestHeaders);
        console.log('Groq API Request Body:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(API_ENDPOINT, requestBody, { headers: requestHeaders });
        // Try to extract and parse JSON from the AI response
        try {
            let aiResponse = response.data.choices[0].message.content;
            const extracted = extractJsonFromText(aiResponse);
            if (extracted) return extracted;
            return {
                raw_text: text,
                structured_data: aiResponse,
                error: "Response was not in JSON format"
            };
        } catch (parseError) {
            return {
                raw_text: text,
                structured_data: response.data.choices[0].message.content,
                error: "Response was not in JSON format"
            };
        }
    } catch (error) {
        console.error('API Processing Error:', error.message);
        throw new Error('Failed to process text with AI model: ' + error.message);
    }
}

async function extractText(filePath, fileType) {
    try {
        const rawText = await new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, 'ocr_extractor.py');
            console.log('Python Path:', PYTHON_PATH);
            console.log('Script Path:', scriptPath);
            console.log('File Path:', filePath);
            console.log('File Type:', fileType);

            const python = spawn(PYTHON_PATH, [scriptPath, filePath, fileType]);
            
            let textOutput = '';
            let errorOutput = '';

            python.stdout.on('data', (data) => {
                textOutput += data.toString();
            });

            python.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error('Python Error:', data.toString());
            });

            python.on('close', (code) => {
                // Clean up the uploaded file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                if (code !== 0) {
                    reject(new Error(`OCR failed: ${errorOutput}`));
                } else {
                    resolve(textOutput.trim());
                }
            });

            python.on('error', (error) => {
                console.error('Process Error:', error);
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });

        // Process the extracted text with AI
        const processedData = await processTextWithAI(rawText);
        return processedData;
    } catch (error) {
        console.error('General Error:', error);
        throw error;
    }
}

async function extractTextFromImage(filePath) {
    return extractText(filePath, 'image');
}

async function extractTextFromScannedPDF(filePath) {
    return extractText(filePath, 'pdf');
}

module.exports = {
    extractTextFromImage,
    extractTextFromScannedPDF
};
