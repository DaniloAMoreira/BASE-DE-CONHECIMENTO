(function () {
'use strict';

// Animação de "sinapses" no fundo. Só desenha enquanto o canvas está visível.
const PARTICLE_COUNT = 70;
const LINK_DISTANCE = 150;

function initSynapses(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: Math.random() * 2 + 1
    }));

    // Ao redimensionar a janela, as partículas acompanham a nova área em vez de ficarem amontoadas.
    window.addEventListener('resize', () => {
        const scaleX = window.innerWidth / (width || 1);
        const scaleY = window.innerHeight / (height || 1);
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        particles.forEach((p) => {
            p.x *= scaleX;
            p.y *= scaleY;
        });
    });

    function drawFrame(move) {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (move) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > width) p.vx = -p.vx;
                if (p.y < 0 || p.y > height) p.vy = -p.vy;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 162, 199, 0.8)';
            ctx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const q = particles[j];
                const distance = Math.hypot(p.x - q.x, p.y - q.y);
                if (distance < LINK_DISTANCE) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 162, 199, ${0.3 - distance / 500})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(q.x, q.y);
                    ctx.stroke();
                }
            }
        }
    }

    if (reduceMotion) {
        drawFrame(false);
        window.addEventListener('resize', () => drawFrame(false));
        return;
    }

    function loop() {
        // getClientRects() fica vazio quando o canvas (ou um ancestral) está com display:none.
        if (canvas.getClientRects().length > 0) drawFrame(true);
        requestAnimationFrame(loop);
    }
    loop();
}

App.background = { initSynapses };
})();
