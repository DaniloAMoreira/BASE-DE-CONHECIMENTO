import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

js = js.replace('initSynapsesCanvas("synapses-canvas");', '')

target = "initSynapsesCanvas('site-synapses-canvas');"
js = js.replace(target, target + "\n    initSynapsesCanvas('synapses-canvas');")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)

