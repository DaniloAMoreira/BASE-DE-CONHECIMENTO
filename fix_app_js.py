import os

with open('app.js', 'r', encoding='utf-8') as f:
    app_js_content = f.read()

# 1. Remove the window.location.replace('index.html'); from the base logic section
app_js_content = app_js_content.replace('''        if (!sessionStorage.getItem('supabaseToken')) {
            window.location.replace('index.html');
        }''', '')
app_js_content = app_js_content.replace('''if (!sessionStorage.getItem('supabaseToken')) {
            window.location.replace('index.html');
        }''', '')

# Also let's check for any other location.replace
import re
app_js_content = re.sub(r'if\s*\(!sessionStorage\.getItem\([^)]*\)\)\s*\{\s*window\.location\.replace\([^)]*\);\s*\}', '', app_js_content)

# 2. Extract tailwind.config
# Find the start of tailwind.config in app.js
tailwind_start = app_js_content.find('tailwind.config = {')
if tailwind_start != -1:
    # Find the end of tailwind.config
    # We will search for '        };' which should close it, or we can just parse the brace level.
    brace_count = 0
    in_config = False
    tailwind_end = -1
    for i in range(tailwind_start, len(app_js_content)):
        char = app_js_content[i]
        if char == '{':
            brace_count += 1
            in_config = True
        elif char == '}':
            brace_count -= 1
            if in_config and brace_count == 0:
                # Need to include trailing semicolon if exists
                if i + 1 < len(app_js_content) and app_js_content[i+1] == ';':
                    tailwind_end = i + 2
                else:
                    tailwind_end = i + 1
                break
    
    if tailwind_end != -1:
        tailwind_config_code = app_js_content[tailwind_start:tailwind_end]
        # Remove from app.js (Note: it appears TWICE because I appended base_logic.js which also had it!)
        app_js_content = app_js_content.replace(tailwind_config_code, '')
        
        # Inject tailwind config back into index.html
        with open('index.html', 'r', encoding='utf-8') as f:
            html = f.read()
        
        # Insert after <script src="https://cdn.tailwindcss.com"></script>
        target = '<script src="https://cdn.tailwindcss.com"></script>'
        if target in html:
            script_block = f'<script>\n{tailwind_config_code}\n</script>'
            html = html.replace(target, f'{target}\n    {script_block}')
            
            with open('index.html', 'w', encoding='utf-8') as f:
                f.write(html)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_js_content)

print('Fixed app.js and index.html')
