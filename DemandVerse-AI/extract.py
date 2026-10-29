import json

with open('DS_Project_Implementation_2.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

with open('extracted_code.py', 'w', encoding='utf-8') as f:
    for i, cell in enumerate(nb['cells']):
        if cell['cell_type'] == 'code':
            f.write(f"\n\n# --- CELL {i} ---\n")
            f.write("".join(cell['source']))
