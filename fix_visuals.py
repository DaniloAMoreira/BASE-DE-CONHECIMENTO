import os

# 1. Update style.css
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

css = css.replace('--bg-app: #11131f;', '--bg-app: #0f172a;')
css = css.replace('--bg-subtle: #141726;', '--bg-subtle: #1e293b;')
css = css.replace('--bg-panel: #182449;', '--bg-panel: #1e293b;')
css = css.replace('--bg-panel-hover: #1d2e62;', '--bg-panel-hover: #334155;')
css = css.replace('--bg-panel-active: #253974;', '--bg-panel-active: #475569;')
css = css.replace('--border-subtle: #304384;', '--border-subtle: #334155;')
css = css.replace('--border-element: #3a4f97;', '--border-element: #475569;')
css = css.replace('--border-hover: #435db1;', '--border-hover: #64748b;')
# Make sure text is visible
css = css.replace('--text-muted: #9eb1ff;', '--text-muted: #94a3b8;')
css = css.replace('--text-high: #d6e1ff;', '--text-high: #f8fafc;')

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css)

# 2. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('<canvas id="webgl-bg"></canvas>', '<canvas id="site-synapses-canvas" class="fixed inset-0 pointer-events-none opacity-80 z-[-1]"></canvas>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

