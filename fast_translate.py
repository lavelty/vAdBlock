import json
import os
import re
import concurrent.futures
from deep_translator import GoogleTranslator

languages = {
    'id': 'id',
    'vi': 'vi',
    'th': 'th',
    'bn': 'bn',
    'zh_TW': 'zh-TW',
    'sr': 'sr',
    'sl': 'sl'
}

base_dir = r"c:/Users/egeko/Desktop/Vade Extensions/lave_adblock/_locales"
tr_file = os.path.join(base_dir, 'tr', 'messages.json')

with open(tr_file, 'r', encoding='utf-8') as f:
    tr_data = json.load(f)

en_file = os.path.join(base_dir, 'en', 'messages.json')
with open(en_file, 'r', encoding='utf-8') as f:
    en_data = json.load(f)

tech_terms = ["vAdBlock", "WebRTC", "CSS", "API", "GitHub", "YouTube", "Canvas", "HTTPS", "Lave", "lave", "GPC/DNT"]

def fix_placeholders(text):
    if not text:
        return text
    text = re.sub(r'\$\s+(\d+)', r'$\1', text)
    for term in tech_terms:
        text = re.sub(re.escape(term), term, text, flags=re.IGNORECASE)
    return text

def translate_value(val, lang_code):
    try:
        translator = GoogleTranslator(source='tr', target=lang_code)
        res = translator.translate(val)
        return fix_placeholders(res)
    except Exception as e:
        print(f"Error: {e}")
        return val

for lang_code, google_code in languages.items():
    print(f"Translating to {lang_code}...")
    
    out_dir = os.path.join(base_dir, lang_code)
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, 'messages.json')
    
    existing_data = {}
    if os.path.exists(out_file):
        try:
            with open(out_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except Exception:
            pass
            
    app_name = existing_data.get('appName', en_data.get('appName'))
    app_desc = existing_data.get('appDesc', en_data.get('appDesc'))
    
    new_data = {}
    
    keys_to_translate = []
    texts_to_translate = []
    
    for k, v in tr_data.items():
        if k == 'extName':
            new_data[k] = {"message": "vAdBlock"}
        elif k == 'appName':
            new_data[k] = app_name
        elif k == 'appDesc':
            new_data[k] = app_desc
        else:
            keys_to_translate.append(k)
            texts_to_translate.append(v['message'])
            
    # parallel translation
    translated_texts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_text = {executor.submit(translate_value, t, google_code): t for t in texts_to_translate}
        results = []
        for future in future_to_text:
            results.append(future)
            
        translated_texts = [f.result() for f in results]

    for k, t in zip(keys_to_translate, translated_texts):
        new_data[k] = {"message": t}
        
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        
    print(f"Finished {lang_code}")
