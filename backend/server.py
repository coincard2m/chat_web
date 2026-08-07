import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Tải biến môi trường từ file .env (nằm cùng thư mục với server.py)
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)
# Kích hoạt CORS để cho phép frontend gọi API
CORS(app)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
RECAPTCHA_SECRET_KEY = os.getenv('RECAPTCHA_SECRET_KEY')

@app.route('/api/verify-gate-recaptcha', methods=['POST'])
def verify_gate_recaptcha():
    data = request.json
    token = data.get('token')
    if not token:
        return jsonify({'success': False, 'error': 'Missing token'}), 400

    payload = {
        'secret': RECAPTCHA_SECRET_KEY,
        'response': token
    }
    
    try:
        res = requests.post('https://www.google.com/recaptcha/api/siteverify', data=payload)
        result = res.json()
        
        if result.get('success', False):
            # Trả về config của Firebase nếu xác minh thành công
            return jsonify({
                'success': True,
                'firebaseConfig': {
                    'apiKey': os.getenv('FIREBASE_API_KEY'),
                    'authDomain': os.getenv('FIREBASE_AUTH_DOMAIN'),
                    'databaseURL': os.getenv('FIREBASE_DATABASE_URL'),
                    'projectId': os.getenv('FIREBASE_PROJECT_ID'),
                    'storageBucket': os.getenv('FIREBASE_STORAGE_BUCKET'),
                    'messagingSenderId': os.getenv('FIREBASE_MESSAGING_SENDER_ID'),
                    'appId': os.getenv('FIREBASE_APP_ID'),
                    'measurementId': os.getenv('FIREBASE_MEASUREMENT_ID')
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Invalid CAPTCHA'})
            
    except Exception as e:
        print("Lỗi verify reCAPTCHA Gate:", str(e))
        return jsonify({'success': False, 'error': 'Server error'}), 500

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    data = request.json
    if not data or 'message' not in data:
        return jsonify({'error': 'Missing message content'}), 400
        
    message = data['message']
    
    if not GEMINI_API_KEY:
        return jsonify({'error': 'GEMINI_API_KEY is not configured on server'}), 500

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [{
            "parts": [{"text": message}]
        }]
    }
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        
        result = response.json()
        
        # Trích xuất đoạn text phản hồi từ Gemini
        if 'candidates' in result and len(result['candidates']) > 0:
            reply = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'reply': reply})
        else:
            return jsonify({'reply': 'Xin lỗi, tôi không thể xử lý yêu cầu lúc này.'})
            
    except Exception as e:
        print("Lỗi khi gọi Gemini API:", str(e))
        return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/api/verify-recaptcha', methods=['POST'])
def verify_recaptcha():
    data = request.json
    token = data.get('token')
    if not token:
        return jsonify({'success': False, 'error': 'Missing token'}), 400

    payload = {
        'secret': RECAPTCHA_SECRET_KEY,
        'response': token
    }
    
    try:
        res = requests.post('https://www.google.com/recaptcha/api/siteverify', data=payload)
        result = res.json()
        return jsonify({'success': result.get('success', False)})
    except Exception as e:
        print("Lỗi verify reCAPTCHA:", str(e))
        return jsonify({'success': False, 'error': 'Server error'}), 500

@app.route('/api/ai/analyze-report', methods=['POST'])
def analyze_report():
    data = request.json
    content = data.get('content', '')
    
    if not GEMINI_API_KEY:
        return jsonify({'error': 'GEMINI_API_KEY is missing'}), 500

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""
Bạn là một AI phân tích báo cáo bạo lực học đường.
Nhiệm vụ của bạn là phân tích nội dung báo cáo sau và trả về DUY NHẤT một chuỗi JSON chuẩn (không chứa markdown hay text nào khác).
JSON phải có cấu trúc sau:
{{
  "isSpam": true/false (đúng nếu nội dung quá ngắn, đùa cợt, vô nghĩa, hoặc không liên quan),
  "spamReason": "lý do vì sao là spam (nếu có)",
  "involvedStudents": ["tên học sinh 1", "tên học sinh 2"] (Trích xuất TÊN của những học sinh khác CÓ LIÊN QUAN được nhắc đến trong bài, không bao gồm người gửi)
}}

Nội dung báo cáo: "{content}"
"""

    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    }
    
    headers = {'Content-Type': 'application/json'}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        result = response.json()
        
        if 'candidates' in result and len(result['candidates']) > 0:
            reply = result['candidates'][0]['content']['parts'][0]['text']
            # Xóa các markdown dư thừa nếu có (ví dụ: ```json ... ```)
            reply = reply.replace('```json', '').replace('```', '').strip()
            return jsonify({'reply': reply})
        else:
            return jsonify({'error': 'No candidate returned'}), 500
            
    except Exception as e:
        print("Lỗi khi gọi Gemini API:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai/summarize-appeal', methods=['POST'])
def summarize_appeal():
    data = request.json
    original = data.get('original', '')
    appeal = data.get('appeal', '')
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""
Bạn là AI cố vấn an toàn học đường. Hãy đối chiếu Báo cáo gốc và Lời kháng cáo của học sinh bị cáo buộc, sau đó viết một đoạn Tóm tắt Đối chiếu (khoảng 3-5 câu) trung lập, nêu rõ quan điểm của cả 2 bên. Không sử dụng suy nghĩ nội tâm hay tiếng Anh.

Báo cáo gốc: {original}
Kháng cáo: {appeal}
"""
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = requests.post(url, json=payload, headers={'Content-Type': 'application/json'})
        result = response.json()
        if 'candidates' in result and len(result['candidates']) > 0:
            reply = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'summary': reply})
        else:
            return jsonify({'summary': 'Không thể tóm tắt.'})
    except Exception as e:
        return jsonify({'summary': 'Lỗi kết nối AI.'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
