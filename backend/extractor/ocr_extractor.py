import fitz
import easyocr
from PIL import Image
import io
import sys
import os

def perform_ocr_on_image(image_path):
    # Load EasyOCR (disable progress bar)
    reader = easyocr.Reader(['en'], verbose=False)
    
    # Perform OCR
    results = reader.readtext(image_path, detail=0)
    return "\n".join(results)

def extract_text_from_pdf(pdf_path):
    # Load EasyOCR (disable progress bar)
    reader = easyocr.Reader(['en'], verbose=False)
    
    # Open and read the PDF
    doc = fitz.open(pdf_path)
    all_text = []

    for page in doc:
        # Convert PDF page to image
        pix = page.get_pixmap(dpi=300)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        
        # Save temporary image
        temp_path = "temp_page.png"
        img.save(temp_path)
        
        # Perform OCR
        results = reader.readtext(temp_path, detail=0)
        all_text.extend(results)
        
        # Clean up temporary file
        os.remove(temp_path)
    
    doc.close()
    return "\n".join(all_text)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python ocr_extractor.py <file_path> <file_type>")
        sys.exit(1)
        
    file_path = sys.argv[1]
    file_type = sys.argv[2]
    
    try:
        if file_type == "pdf":
            text = extract_text_from_pdf(file_path)
        else:
            text = perform_ocr_on_image(file_path)
        print(text)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
