(() => {
    // ==========================================
    // セキュリティとスコープの確保 (IIFE)
    // ==========================================

    const sliderTrack = document.getElementById('sliderTrack');
    const hourHand = document.getElementById('hourHand');
    const minuteHand = document.getElementById('minuteHand');
    const speedBtns = document.querySelectorAll('.speed-btn');
    
    // 【修正】Canvas要素の取得
    const speedGraph = document.getElementById('speedGraph');
    const ctx = speedGraph.getContext('2d');

    let points = [0, 16.66, 33.33, 50, 66.66, 83.33, 100];
    const MIN_DISTANCE = 5; 

    let speedMultiplier = 1; 
    let simulatedStandardTime = 0; 
    let lastFrameTime = performance.now(); 
    
    let justReturnedToNormal = false; 

    let currentDistortedHours = 0; 
    let intermediateTarget = 0;    
    let targetDistortedHours = 0;  
    
    function init() {
        createSliderPoints();
        updateGraph(); // 【修正】初期化時に線グラフを描画
        setupButtons();
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        simulatedStandardTime = now.getTime() - startOfToday; 

        const standardHours = simulatedStandardTime / 3600000;
        currentDistortedHours = calculateTargetDistortedTime(standardHours);
        intermediateTarget = currentDistortedHours;

        requestAnimationFrame(updateClock);
    }

    function createSliderPoints() {
        points.forEach((pos, index) => {
            const pointEl = document.createElement('div');
            pointEl.className = 'slider-point';
            pointEl.style.left = `${pos}%`;
            
            if (index === 0 || index === points.length - 1) {
                pointEl.classList.add('fixed');
            } else {
                setupDrag(pointEl, index);
            }
            sliderTrack.appendChild(pointEl);
        });
    }

    function setupDrag(element, index) {
        let isDragging = false;

        const onMove = (clientX) => {
            if (!isDragging) return;
            const rect = sliderTrack.getBoundingClientRect();
            let newPercent = ((clientX - rect.left) / rect.width) * 100;

            const minAllowed = points[index - 1] + MIN_DISTANCE;
            const maxAllowed = points[index + 1] - MIN_DISTANCE;

            newPercent = Math.max(minAllowed, Math.min(newPercent, maxAllowed));
            points[index] = newPercent;
            element.style.left = `${newPercent}%`;
            
            // 【修正】スライダーが動くたびに線グラフを再描画
            updateGraph();
        };

        element.addEventListener('mousedown', () => { isDragging = true; });
        document.addEventListener('mousemove', (e) => onMove(e.clientX));
        document.addEventListener('mouseup', () => { isDragging = false; });

        element.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });
        document.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
        document.addEventListener('touchend', () => { isDragging = false; });
    }

    // ==========================================
    // 【完全書き換え】Canvasを使った線グラフ描画関数
    // ==========================================
    function updateGraph() {
        if (!ctx) return;
        const width = speedGraph.width;
        const height = speedGraph.height;
        const graphHeight = height - 20; // 下部のテキスト（ラベル）用の余白
        
        // 1. Canvasをクリア
        ctx.clearRect(0, 0, width, height);

        // 2. 基準線（現実の標準時間 = 16.66%）の点線を描画
        ctx.beginPath();
        ctx.moveTo(0, graphHeight / 2);
        ctx.lineTo(width, graphHeight / 2);
        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]); // 点線設定をリセット

        // 各セクションの幅（長さ）を計算
        const intervals = [];
        for (let i = 0; i < 6; i++) {
            intervals.push(points[i + 1] - points[i]);
        }

        // X軸（時間帯）のラベル
        const labels = ['0-4', '4-8', '8-12', '12-16', '16-20', '20-24'];
        
        // 各データポイント（X, Y座標）の計算
        const coords = intervals.map((val, index) => {
            const padding = 25; // グラフ左右の余白
            const step = (width - padding * 2) / 5;
            const x = padding + index * step;
            
            // val=16.66(等分)の時、グラフの中央(graphHeight/2)に来るように計算。
            // グラフが上に行くほど値が大きい（ゆっくり進む）、下に行くほど値が小さい（速く進む）
            let y = graphHeight / 2 - (val - 16.66) * (graphHeight / 2 / 16.66);
            
            // Canvasからはみ出さないように制限をかける
            y = Math.max(5, Math.min(graphHeight - 5, y)); 
            
            return { x, y, label: labels[index] };
        });

        // 3. 折れ線の描画
        ctx.beginPath();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        coords.forEach((c, i) => {
            if (i === 0) ctx.moveTo(c.x, c.y);
            else ctx.lineTo(c.x, c.y);
        });
        ctx.stroke();

        // 4. データポイントの点（黒丸）とラベルテキストの描画
        coords.forEach(c => {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(c.label, c.x, height - 5);
        });
    }

    // ==========================================
    // 時間計算・時計更新ロジック
    // ==========================================
    function setupButtons() {
        speedBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const newSpeed = parseInt(btn.dataset.speed);
                
                if (speedMultiplier !== 1 && newSpeed === 1) {
                    justReturnedToNormal = true;
                }
                speedMultiplier = newSpeed;

                if (speedMultiplier === 1) {
                    const now = new Date();
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    simulatedStandardTime = now.getTime() - startOfToday;
                }
            });
        });
    }

    function calculateTargetDistortedTime(standardHours) {
        const sectionIndex = Math.floor(standardHours / 4);
        if (sectionIndex >= 6) return 0; 

        const fractionInSection = (standardHours % 4) / 4;
        const intervals = [];
        for (let i = 0; i < 6; i++) {
            intervals.push((points[i + 1] - points[i]) / 100);
        }

        let accumulatedDistortedHours = 0;
        for (let i = 0; i < sectionIndex; i++) {
            accumulatedDistortedHours += intervals[i] * 24;
        }

        const currentSectionDistortedHours = (intervals[sectionIndex] * 24) * fractionInSection;
        return accumulatedDistortedHours + currentSectionDistortedHours;
    }

    function getShortestDiff(target, current) {
        let diff = target - current;
        diff = ((diff + 12) % 24 + 24) % 24 - 12;
        return diff;
    }

    function updateClock(timestamp) {
        const dt = timestamp - lastFrameTime;
        lastFrameTime = timestamp;

        simulatedStandardTime += dt * speedMultiplier;
        const msInDay = 86400000;
        simulatedStandardTime = simulatedStandardTime % msInDay;

        const standardHours = simulatedStandardTime / 3600000;
        targetDistortedHours = calculateTargetDistortedTime(standardHours);

        if (speedMultiplier === 1) {
            if (justReturnedToNormal) {
                currentDistortedHours = targetDistortedHours;
                intermediateTarget = targetDistortedHours;
                justReturnedToNormal = false; 
            } else {
                const factor = Math.min(dt / 15000, 1);
                const diff1 = getShortestDiff(targetDistortedHours, intermediateTarget);
                intermediateTarget += diff1 * factor;

                const diff2 = getShortestDiff(intermediateTarget, currentDistortedHours);
                currentDistortedHours += diff2 * factor;

                intermediateTarget = (intermediateTarget % 24 + 24) % 24;
                currentDistortedHours = (currentDistortedHours % 24 + 24) % 24;
            }
        } else {
            currentDistortedHours = targetDistortedHours; 
            intermediateTarget = targetDistortedHours;
        }

        const hourAngle = currentDistortedHours * 30; 
        const minuteAngle = (currentDistortedHours * 60) % 60 * 6; 

        hourHand.style.transform = `translateX(-50%) rotate(${hourAngle}deg)`;
        minuteHand.style.transform = `translateX(-50%) rotate(${minuteAngle}deg)`;

        requestAnimationFrame(updateClock);
    }

    init();

})();