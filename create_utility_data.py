import os

def escape_content(content):
    # Escape backticks for JS template literal
    content = content.replace('\\', '\\\\') # Escape backslashes first
    content = content.replace('`', '\\`')
    content = content.replace('${', '\\${') # Escape template literal interpolation
    return content

try:
    with open('gas.csv', 'r', encoding='utf-8') as f:
        gas_content = f.read()
    
    with open('we.csv', 'r', encoding='utf-8') as f:
        we_content = f.read()

    js_content = f"const GAS_CSV_TEXT = `{escape_content(gas_content)}`;\n"
    js_content += f"const WE_CSV_TEXT = `{escape_content(we_content)}`;\n"

    with open('utility_data.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print("Successfully created utility_data.js")

except Exception as e:
    print(f"Error: {e}")
