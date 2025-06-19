import re
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

# Setup logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def clean_text(raw_text: str) -> str:
    """Clean and normalize OCR text before field extraction"""
    
    # 1. Replace smart quotes with regular ones
    text = raw_text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")
    
    # 2. Remove content in square brackets
    text = re.sub(r'\[.*?\]', '', text)
    
    # 3. Remove known UI artifacts and garbage (expanded list)
    ui_garbage = [
        'NM', '►', '▼', '□', '■', '●', '○', '✓', '✔', '✗', '✘',
        'v', 'V', '▾', '▿', '↓', '⌄', '∨'  # Common dropdown arrow variants
    ]
    for item in ui_garbage:
        text = text.replace(item, '')
    
    # Special handling for account type field
    text = re.sub(r'(savings|current|checking)[v▾▿↓⌄∨V]+', r'\1', text, flags=re.IGNORECASE)
    
    # 4. Keep only allowed characters
    # Allow: letters, numbers, basic punctuation, newlines
    text = re.sub(r'[^a-zA-Z0-9\s\.\,\:\-\/@\n]', '', text)
    
    # 5. Fix spacing issues
    # Normalize newlines
    text = re.sub(r'[\r\n]+', '\n', text)
    # Remove extra spaces
    text = re.sub(r' +', ' ', text)
    # Remove spaces at start/end of lines
    text = '\n'.join(line.strip() for line in text.split('\n'))
    # Remove empty lines
    text = re.sub(r'\n\s*\n', '\n', text)
    
    return text.strip()

def is_garbage_line(line: str) -> bool:
    """Check if a line is likely OCR garbage"""
    # Cleanup and normalize the line
    line = line.strip().lower()
    
    # Skip empty lines
    if not line:
        return True
        
    # Skip lines that are just numbers
    if line.isdigit():
        return True
        
    # Skip common UI elements and form text
    ui_words = {
        'submit', 'cancel', 'signature', 'date', 'sign', 'here',
        'click', 'next', 'previous', 'continue', 'back', 'done'
    }
    
    if line in ui_words:
        return True
        
    # Skip lines that look like page numbers
    if re.match(r'^page\s*\d+$', line):
        return True
        
    return False

def clean_address(address_lines: list) -> str:
    """Clean and format address lines"""
    # Filter out garbage lines
    clean_lines = []
    
    for line in address_lines:
        line = line.strip()
        if not line or is_garbage_line(line):
            continue
            
        # Remove any trailing numbers or punctuation
        line = re.sub(r'\s*\d+\s*$', '', line)
        line = re.sub(r'[,\s]+$', '', line)
        
        if line:  # Only add non-empty lines
            clean_lines.append(line)
    
    # Join with commas and clean up any double commas
    address = ', '.join(clean_lines)
    address = re.sub(r',\s*,', ',', address)
    address = re.sub(r',\s*$', '', address)  # Remove trailing comma
    
    return address

def extract_from_fixed_form(text: str) -> dict:
    # Clean the text first
    cleaned_text = clean_text(text)
    logger.debug(f"Cleaned text:\n{cleaned_text}")
    
    # Process cleaned text with standardized field order
    lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
    result = {
        "name": "",
        "dob": "",
        "accountType": "",
        "phone": "",
        "email": "",
        "address": ""
    }

    def extract_after(keyword):
        try:
            idx = lines.index(keyword)
            value = lines[idx + 1].strip()
            # Extra cleaning for account type
            if keyword == "Account Type":
                value = re.sub(r'[v▾▿↓⌄∨V]+$', '', value).strip()
            return value
        except:
            return ""

    # Extract fields in consistent order
    result["name"] = extract_after("Full Name") or extract_after("Name")
    result["dob"] = extract_after("Date of Birth") or extract_after("DOB")
    result["accountType"] = extract_after("Account Type")
    result["phone"] = extract_after("Phone Number") or extract_after("Mobile")
    result["email"] = extract_after("Email") or extract_after("Email Address")

    # Enhanced address handling
    if "Address" in lines:
        addr_start = lines.index("Address") + 1
        addr_lines = []
        
        # Collect address lines until we hit garbage or end
        for line in lines[addr_start:]:
            if is_garbage_line(line):
                break
            addr_lines.append(line)
        
        # Clean and format the address
        result["address"] = clean_address(addr_lines)

    return result

def format_output(input_text: str, result: dict) -> str:
    """Format the input and output in a clear presentation"""
    separator = "=" * 50
    output = f"""
Input Text:
{separator}
{input_text.strip()}
{separator}

Extracted Fields:
{separator}
{json.dumps(result, indent=2)}
{separator}
"""
    return output

@app.route('/process-text', methods=['POST'])
def process_text():
    try:
        logger.info("Received process-text request")
        data = request.get_json()
        
        if not data or 'text' not in data:
            logger.error("No text field in request")
            return jsonify({"error": "No text provided"}), 400
            
        extracted_text = data['text']
        logger.info(f"Original text: {extracted_text[:100]}...")
        
        # Process the cleaned text
        fields = extract_from_fixed_form(extracted_text)
        logger.info(f"Extracted fields: {fields}")
        
        # Return both input and processed results
        response = {
            "input": extracted_text,
            "cleaned": clean_text(extracted_text),  # Include cleaned text for debugging
            "results": fields
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error processing text: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 400

# Remove all PDF-specific routes and functions

# Example usage
if __name__ == "__main__":
    logger.info("Starting Flask server on port 5001")
    app.run(port=5001, debug=True)
