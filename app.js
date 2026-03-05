function parseInputs() {
      // L in mH -> H, C in nF -> F
      const L = parseFloat(document.getElementById('L').value) * 1e-3;
      const C = parseFloat(document.getElementById('C').value) * 1e-9;
      const R = parseFloat(document.getElementById('R').value);
      const Vin = parseFloat(document.getElementById('Vin').value);
      const fStart = parseFloat(document.getElementById('fStart').value);
      const fEnd = parseFloat(document.getElementById('fEnd').value);
      const pts = parseInt(document.getElementById('points').value);
      const scale = document.getElementById('scale').value;
      return {L, C, R, Vin, fStart, fEnd, pts, scale};
    }

    // Compute series LCR current magnitude for array of frequencies
    // For each frequency f (Hz): omega = 2*pi*f
    // Impedance Z = R + j(omega*L - 1/(omega*C))
    // |Z| = sqrt(R^2 + (omega*L - 1/(omega*C))^2)
    // I = Vin / |Z|
    function computeIFS(params) {
      const {L,C,R,Vin,fStart,fEnd,pts,scale} = params;
      let freqs = [];
      if (scale === 'log') {
        const logStart = Math.log10(Math.max(fStart,1e-12));
        const logEnd = Math.log10(fEnd);
        for (let i=0;i<pts;i++) {
          const t = i/(pts-1);
          freqs.push(Math.pow(10, logStart + t*(logEnd-logStart)));
        }
      } else {
        for (let i=0;i<pts;i++) freqs.push(fStart + i*(fEnd - fStart)/(pts-1));
      }
      const currents = freqs.map(f=>{
        const w = 2*Math.PI*f;
        const reactance = w*L - 1/(w*C);
        const magZ = Math.sqrt(R*R + reactance*reactance);
        return Vin / magZ;
      });
      return {freqs, currents};
    }

    // Resonant frequency for series LCR: f0 = 1/(2*pi*sqrt(L*C))
    // Quality factor for series LCR: Q = (1/R) * sqrt(L/C)
    function resonanceParams(L,C,R,Vin) {
      const f0 = 1/(2*Math.PI*Math.sqrt(L*C));
      const Q = (1/R) * Math.sqrt(L/C);
      // Current at resonance: Ires = Vin / R (because reactance cancels)
      const Ires = Vin / R;
      return {f0,Q,Ires};
    }

    // Format numbers nicely
    function fmt(x, digits=4) { if (!isFinite(x)) return '—'; if (Math.abs(x)>=1e6||Math.abs(x)<=1e-3) return x.toExponential(3); return Number(x.toFixed(digits)); }

    // Chart setup
    const ctx = document.getElementById('chart').getContext('2d');
    let myChart = new Chart(ctx, {
      type: 'line',
      data: {labels: [], datasets: [{label:'Current (A)', data: [], tension:0.18, pointRadius:0}]},
      options: {
        animation:false,
        responsive:true,
        scales: {
          x: {type:'linear', title:{display:true,text:'Frequency (Hz)'}},
          y: {title:{display:true,text:'Current (A)'}, beginAtZero:true}
        },
        plugins: {
          legend:{display:false},
          tooltip:{mode:'index',intersect:false,callbacks:{label:ctx=>`I = ${ctx.formattedValue} A`}},
          annotation: {annotations: {resLine:{type:'line',xMin:0,xMax:0, borderColor:'rgba(255,255,255,0.3)',borderWidth:1,label:{content:'f0',enabled:true}}}}
        }
      }
    });

    // Update/resimulate
    function simulateAndPlot() {
      const params = parseInputs();
      const {L,C,R,Vin,fStart,fEnd,pts,scale} = params;

      // Guard: basic validation
      if (!(L>0 && C>0 && R>0 && pts>1 && fEnd>fStart)) {
        alert('Please enter valid positive values and ensure End frequency > Start frequency.');
        return;
      }

      const {freqs,currents} = computeIFS(params);
      const {f0,Q,Ires} = resonanceParams(L,C,R,Vin);

      // Update summary pills
      document.getElementById('resonant').innerHTML = `Resonant f<sub>0</sub>: <strong>${fmt(f0,5)}</strong> Hz`;
      document.getElementById('Qv').innerHTML = `Quality factor Q: <strong>${fmt(Q,4)}</strong>`;
      document.getElementById('Ires').innerHTML = `I<sub>res</sub>: <strong>${fmt(Ires,5)}</strong> A`;

      // Prepare data for Chart.js — use numeric x,y pairs so we can switch x-scale
      const points = freqs.map((f,i)=>({x:f,y:currents[i]}));

      // Update chart axes type
      myChart.options.scales.x.type = (scale==='log' ? 'logarithmic' : 'linear');
      myChart.data.labels = freqs;
      myChart.data.datasets[0].data = points;

      // Update annotation for resonance vertical line
      if (myChart.options.plugins.annotation && myChart.options.plugins.annotation.annotations && myChart.options.plugins.annotation.annotations.resLine) {
        myChart.options.plugins.annotation.annotations.resLine.xMin = f0;
        myChart.options.plugins.annotation.annotations.resLine.xMax = f0;
        myChart.options.plugins.annotation.annotations.resLine.label.content = `f0 = ${fmt(f0,5)} Hz`;
      }

      myChart.update();
    }

    // CSV download
    function downloadCSV() {
      const params = parseInputs();
      const {freqs,currents} = computeIFS(params);
      let csv = 'frequency_hz,current_A\n';
      for (let i=0;i<freqs.length;i++) csv += `${freqs[i]},${currents[i]}\n`;
      const blob = new Blob([csv],{type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'lcr_frequency_current.csv'; a.click(); URL.revokeObjectURL(url);
    }

    // Event listeners
    document.getElementById('simulate').addEventListener('click', simulateAndPlot);
    document.getElementById('download').addEventListener('click', downloadCSV);
    document.getElementById('reset').addEventListener('click', ()=>{
      document.getElementById('L').value = 10; document.getElementById('C').value = 100; document.getElementById('R').value = 5; document.getElementById('Vin').value = 1; document.getElementById('fStart').value = 10; document.getElementById('fEnd').value=10000; document.getElementById('points').value=400; document.getElementById('scale').value='linear';
      simulateAndPlot();
    });

    // Real-time update listeners for all input fields
    const inputIds = ['L', 'R', 'C', 'Vin', 'fStart', 'fEnd', 'points', 'scale'];
    inputIds.forEach(id => {
      document.getElementById(id).addEventListener('input', simulateAndPlot);
    });

    // Auto-run initial simulation
    window.addEventListener('load', simulateAndPlot);