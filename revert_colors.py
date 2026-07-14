import re

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Current slate palette
slate_palette = {
    '--bg-app': '#0f172a',
    '--bg-subtle': '#1e293b',
    '--bg-panel': '#1e293b',
    '--bg-panel-hover': '#334155',
    '--bg-panel-active': '#475569',
    '--border-subtle': '#334155',
    '--border-element': '#475569',
    '--border-hover': '#64748b',
    '--text-muted': '#94a3b8',
    '--text-high': '#f8fafc'
}

# New vivid palette (darker background, vibrant panels like before)
new_palette = {
    '--bg-app': '#060a13', # Very dark, almost black navy for better contrast
    '--bg-subtle': '#0c1527',
    '--bg-panel': '#14254b', # Vibrant dark blue
    '--bg-panel-hover': '#1b3266',
    '--bg-panel-active': '#244388',
    '--border-subtle': '#1f3870',
    '--border-element': '#2b4d99',
    '--border-hover': '#3b66c4',
    '--text-muted': '#a3b8e0',
    '--text-high': '#ffffff'
}

for key, old_val in slate_palette.items():
    new_val = new_palette[key]
    css = re.sub(f'{key}:\s*{old_val};', f'{key}: {new_val};', css)

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

