import os
import re
from flask import Flask, render_template, request, jsonify
from groq import Groq
from dotenv import load_dotenv
from flask_cors import CORS

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize Groq client
client = Groq(api_key=os.getenv('GROQ_API_KEY'))

class LanguageDetector:
    @staticmethod
    def detect_language(code):
        """
        Detect programming language based on code characteristics
        """
        language_patterns = {
            'python': [
                r'def\s+\w+\s*\(',      # Function definition
                r'class\s+\w+:',         # Class definition
                r'import\s+\w+',         # Import statement
                r'#\s*!',                # Shebang line
                r'print\(',               # Python print function
                r'def\s*__\w+__\s*\('     # Dunder methods
            ],
            'javascript': [
                r'function\s+\w+\s*\(',   # Function declaration
                r'const\s+\w+\s*=',       # Const declaration
                r'let\s+\w+\s*=',         # Let declaration
                r'class\s+\w+\s*{',       # Class definition
                r'\.\w+\s*=\s*function\(', # Method definition
                r'export\s+(default\s+)?'  # ES6 module export
            ],
            'java': [
                r'public\s+class\s+\w+',  # Public class definition
                r'import\s+\w+\.\w+;',    # Import statement
                r'private\s+\w+\s+\w+',   # Private member
                r'@\w+',                  # Annotations
                r'public\s+\w+\s*\('      # Public method
            ],
            'cpp': [
                r'#include\s*<\w+>',      # Include directive
                r'int\s+main\s*\(',        # Main function
                r'class\s+\w+\s*{',       # Class definition
                r'std::',                 # Standard library
                r'\w+::\w+\s*\('          # Method definition
            ],
            'ruby': [
                r'def\s+\w+',             # Method definition
                r'class\s+\w+',            # Class definition
                r'require\s+[\'"][\w\/]+[\'"]', # Require statement
                r'\.\w+\s*do\s*\|'         # Block syntax
            ],
            'php': [
                r'<\?php',                # PHP opening tag
                r'function\s+\w+\s*\(',    # Function definition
                r'\$\w+\s*=',             # Variable assignment
                r'class\s+\w+',           # Class definition
                r'public\s+function'       # Public method
            ],
            'swift': [
                r'func\s+\w+\s*\(',        # Function definition
                r'class\s+\w+',            # Class definition
                r'import\s+\w+',           # Import statement
                r'let\s+\w+\s*=',          # Let declaration
                r'var\s+\w+\s*='           # Var declaration
            ],
            'go': [
                r'func\s+\w+\s*\(',        # Function definition
                r'package\s+\w+',          # Package declaration
                r'import\s*\(',            # Import statement
                r'type\s+\w+\s+struct',    # Struct definition
                r'\w+\s*:='                # Short variable declaration
            ],
            'rust': [
                r'fn\s+\w+\s*\(',          # Function definition
                r'use\s+\w+::',            # Use statement
                r'struct\s+\w+',           # Struct definition
                r'let\s+\w+\s*=',          # Let declaration
                r'mut\s+\w+'               # Mutable variable
            ],
            'typescript': [
                r'function\s+\w+\s*\(',    # Function definition
                r'interface\s+\w+',        # Interface definition
                r'class\s+\w+<.*>',        # Generic class
                r'const\s+\w+\s*:',        # Typed const
                r'export\s+(default\s+)?'  # Module export
            ],
            'sql': [
                r'\bSELECT\b',            # Select statement
                r'\bFROM\b',              # From clause
                r'\bWHERE\b',             # Where clause
                r'\bINSERT\s+INTO\b',     # Insert statement
                r'\bCREATE\s+TABLE\b'     # Create table
            ]
        }

        # Score languages based on pattern matches
        language_scores = {}
        for lang, patterns in language_patterns.items():
            matches = sum(1 for pattern in patterns if re.search(pattern, code, re.IGNORECASE))
            if matches > 0:
                language_scores[lang] = matches

        # Return the language with the most matches, default to 'unknown'
        return max(language_scores, key=language_scores.get, default='unknown')

class CodeAnalyzer:
    @staticmethod
    def get_analysis_prompt(language, analysis_type):
        """
        Generate a tailored analysis prompt based on language and analysis type
        """
        prompts = {
            'explain': f"""
            You are an expert code explainer for {language} code. Provide a detailed, step-by-step explanation:
            1. Describe the overall purpose of the code
            2. Break down each section/function
            3. Explain key algorithms or logic
            4. Point out any best practices or potential improvements
            
            Code to explain:
            {{}}
            """,
            
            'debug': f"""
            You are a professional {language} code debugger. Analyze the code and:
            1. Identify potential bugs or issues
            2. Suggest specific fixes for each problem
            3. Provide recommendations to improve code quality
            4. Highlight any potential security vulnerabilities
            
            Code to debug:
            {{}}
            """,
            
            'optimize': f"""
            You are a performance optimization expert for {language} code. Review and:
            1. Identify performance bottlenecks
            2. Suggest more efficient algorithms or data structures
            3. Provide specific code refactoring recommendations
            4. Estimate potential performance gains
            
            Original Code:
            {{}}
            """
        }
        return prompts.get(analysis_type, prompts['explain'])

    @staticmethod
    def analyze_code(code, language, analysis_type):
        """
        Perform code analysis using Groq
        """
        try:
            prompt = CodeAnalyzer.get_analysis_prompt(language, analysis_type).format(code)
            
            chat_completion = client.chat.completions.create(
                messages=[{
                        "role": "system",
                        "content": f"You are a helpful AI code assistant specialized in {language} code analysis."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }],
                model="mixtral-8x7b-32768",
                temperature=0.3,
                max_tokens=2048
            )
            
            return chat_completion.choices[0].message.content
        
        except Exception as e:
            return f"Analysis Error: {str(e)}"

@app.route('/')
def home():
    return render_template('index.html')  # Render the home page (index.html)

@app.route('/analyze', methods=['POST'])
def analyze_code_route():
    try:
        data = request.json
        code = data.get('code', '').strip()
        
        if not code:
            return jsonify({'success': False, 'error': 'No code provided'}), 400
        
        # Detect language if not provided
        language = data.get('language', LanguageDetector.detect_language(code))
        analysis_type = data.get('type', 'explain')
        
        result = CodeAnalyzer.analyze_code(code, language, analysis_type)
        
        return jsonify({
            'success': True, 
            'result': result,
            'type': analysis_type,
            'language': language
        })
    
    except Exception as e:
        app.logger.error(f"Analysis error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)  # Run the Flask app
