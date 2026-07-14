# -*- coding: utf-8 -*-
import re

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

synapses_func = """
function initSynapsesCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let particles = [];
    const maxParticles = 70;
    
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    class Particle {
        constructor() {
            this.x = (window.secureRandom ? secureRandom() : Math.random()) * width;
            this.y = (window.secureRandom ? secureRandom() : Math.random()) * height;
            this.vx = ((window.secureRandom ? secureRandom() : Math.random()) - 0.5) * 1.5;
            this.vy = ((window.secureRandom ? secureRandom() : Math.random()) - 0.5) * 1.5;
            this.radius = (window.secureRandom ? secureRandom() : Math.random()) * 2 + 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx = -this.vx;
            if (this.y < 0 || this.y > height) this.vy = -this.vy;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 162, 199, 0.8)';
            ctx.fill();
        }
    }

    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }

    function animateSynapses() {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < maxParticles; i++) {
            particles[i].update();
            particles[i].draw();
            for (let j = i + 1; j < maxParticles; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = gba(0, 162, 199, );
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animateSynapses);
    }
    animateSynapses();
}

document.addEventListener('DOMContentLoaded', () => {
    initSynapsesCanvas('site-synapses-canvas');
});
"""

# Removing old synapses logic: We search for the synapsesCanvas initialization block
old_synapses_match = re.search(r'const synapsesCanvas = document\.getElementById\(\'synapses-canvas\'\);.*?requestAnimationFrame\(animateSynapses\);\s*\}\s*animateSynapses\(\);\s*\}', js, flags=re.DOTALL)
if old_synapses_match:
    js = js.replace(old_synapses_match.group(0), 'initSynapsesCanvas("synapses-canvas");')

# Remove WebGL logic
js = re.sub(r'const initWebGLBackground = \(\) => \{.*?\};\s*', '', js, flags=re.DOTALL)
# Also remove any calls to it inside DOMContentLoaded
js = re.sub(r'initWebGLBackground\(\);', '', js)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(synapses_func + '\n' + js)

