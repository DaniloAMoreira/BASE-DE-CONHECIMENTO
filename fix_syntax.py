import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

leftover = "animate(); window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }); };"
js = js.replace(leftover, "")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(js)
