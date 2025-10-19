import { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Pause, RotateCcw, Download } from 'lucide-react';
import GIF from 'gif.js';
import seedrandom from 'seedrandom';

const SIRSimulation = () => {
  const [params, setParams] = useState({
    M: 50,
    N: 50,
    I0: 5,
    T: 100,
    r: 1,
    beta: 0.8,
    alpha: 0.1
  });

  const [isRunning, setIsRunning] = useState(false);
  const [grid, setGrid] = useState(null);
  const [history, setHistory] = useState([]);
  const [time, setTime] = useState(0);
  const canvasRef = useRef(null);
  const animationRef = useRef([]);

  // NEW: Nexp + fixed-seed init + holder for the initial grid
  const [Nexp, setNexp] = useState(10);
  const initSeed = 'grid-init-12345';
  const initGridRef = useRef(null);

  // ---------- Fixed seeded initial grid ----------
  const makeInitialGrid = () => {
    const rng = seedrandom(initSeed);
    const g = Array(params.M).fill(0).map(() => Array(params.N).fill(0));
    const used = new Set();
    let placed = 0;
    while (placed < params.I0) {
      const x = Math.floor(rng() * params.M);
      const y = Math.floor(rng() * params.N);
      const key = `${x},${y}`;
      if (!used.has(key)) {
        used.add(key);
        g[x][y] = 1; // infectado
        placed++;
      }
    }
    return g;
  };

  const initializeGrid = () => {
    // set once (fixed init for all Nexp runs); then clone to show
    if (!initGridRef.current) initGridRef.current = makeInitialGrid();
    const clone = initGridRef.current.map(row => [...row]);
    setGrid(clone);
    setHistory([]);
    setTime(0);
    animationRef.current = [];
  };

  // re-init when size or I0 changes
  useEffect(() => {
    initGridRef.current = null; // force rebuild with seed & new params
    initializeGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.M, params.N, params.I0]);

  // ---------- Core helpers ----------
  const getNeighbors = (grid, x, y, radius) => {
    let infected = 0;
    let total = 0;
    for (let i = x - radius; i <= x + radius; i++) {
      for (let j = y - radius; j <= y + radius; j++) {
        if (i !== x || j !== y) {
          const ii = (i + params.M) % params.M;
          const jj = (j + params.N) % params.N;
          total++;
          if (grid[ii][jj] === 1) infected++;
        }
      }
    }
    return { infected, total };
  };

  const step = (currentGrid) => {
    const newGrid = Array(params.M).fill(0).map(() => Array(params.N).fill(0));
    for (let i = 0; i < params.M; i++) {
      for (let j = 0; j < params.N; j++) {
        if (currentGrid[i][j] === 2) {
          newGrid[i][j] = 2;
        } else if (currentGrid[i][j] === 1) {
          newGrid[i][j] = Math.random() < params.alpha ? 2 : 1;
        } else {
          const { infected, total } = getNeighbors(currentGrid, i, j, params.r);
          const infectionProb = infected > 0 ? params.beta * (infected / total) : 0;
          newGrid[i][j] = Math.random() < infectionProb ? 1 : 0;
        }
      }
    }
    return newGrid;
  };

  const countStates = (g) => {
    let s = 0, i = 0, r = 0;
    for (let x = 0; x < params.M; x++) {
      for (let y = 0; y < params.N; y++) {
        if (g[x][y] === 0) s++;
        else if (g[x][y] === 1) i++;
        else r++;
      }
    }
    return { s, i, r };
  };

  // ---------- Visible run (animated) ----------
  const drawGrid = (g, canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cellSize = Math.min(canvas.width / params.N, canvas.height / params.M);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < params.M; i++) {
      for (let j = 0; j < params.N; j++) {
        const x = j * cellSize;
        const y = i * cellSize;
        ctx.fillStyle = (g[i][j] === 0) ? '#3b82f6' : (g[i][j] === 1) ? '#ef4444' : '#10b981';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  };

  useEffect(() => {
    if (!isRunning || !grid || time >= params.T) {
      setIsRunning(false);
      return;
    }
    const timer = setTimeout(() => {
      const newGrid = step(grid);
      const counts = countStates(newGrid);
      setGrid(newGrid);
      setHistory(prev => [...prev, { t: time, ...counts }]);
      setTime(time + 1);
      animationRef.current.push(JSON.parse(JSON.stringify(newGrid)));
      drawGrid(newGrid, canvasRef.current);
    }, 50);
    return () => clearTimeout(timer);
  }, [isRunning, grid, time]);

  useEffect(() => {
    if (grid) drawGrid(grid, canvasRef.current);
  }, [grid]);

  const generateGif = async () => {
    if (animationRef.current.length === 0) {
      alert('Ejecuta la simulación primero');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const frames = animationRef.current.slice(0, Math.min(150, animationRef.current.length));
    const cellSize = Math.min(canvas.width / params.N, canvas.height / params.M);
    const gif = new GIF({ workers: 2, quality: 10, width: canvas.width, height: canvas.height });

    frames.forEach((frame) => {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < params.M; i++) {
        for (let j = 0; j < params.N; j++) {
          const x = j * cellSize, y = i * cellSize;
          const val = frame[i][j];
          ctx.fillStyle = (val === 0) ? '#3b82f6' : (val === 1) ? '#ef4444' : '#10b981';
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
      gif.addFrame(canvas, { delay: 60 });
    });

    gif.on('finished', (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'sir_simulation.gif'; a.click();
      URL.revokeObjectURL(url);
    });

    gif.render();
  };

  // ---------- Nexp headless runs → JSON (same schema as Python) ----------
  const runOnceNoAnimate = () => {
    let g = initGridRef.current.map(row => [...row]); // clone fixed init
    const hist = [];
    for (let t = 0; t <= params.T; t++) {
      const { s, i, r } = countStates(g);
      hist.push({ t, s, i, r });
      if (t < params.T) g = step(g);
    }
    return hist;
  };

  const exportNexpJSON = () => {
    if (!initGridRef.current) initGridRef.current = makeInitialGrid();

    const runs = [];
    const accS = Array(params.T + 1).fill(0);
    const accI = Array(params.T + 1).fill(0);
    const accR = Array(params.T + 1).fill(0);

    for (let k = 0; k < Nexp; k++) {
      const hist = runOnceNoAnimate();
      runs.push({
        run_id: k,
        t: hist.map(x => x.t),
        s: hist.map(x => x.s),
        i: hist.map(x => x.i),
        r: hist.map(x => x.r),
      });
      for (let t = 0; t <= params.T; t++) {
        accS[t] += hist[t].s;
        accI[t] += hist[t].i;
        accR[t] += hist[t].r;
      }
    }

    const mean = {
      t: [...Array(params.T + 1)].map((_, t) => t),
      s: accS.map(v => v / Nexp),
      i: accI.map(v => v / Nexp),
      r: accR.map(v => v / Nexp),
    };

    const payload = {
      meta: {
        model: 'grid',
        params,
        Nexp,
        seed_init: initSeed,
        note: 'Fixed-seed initial infected; headless Nexp averaging'
      },
      runs,
      mean
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sir_grid_results.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const counts = grid ? countStates(grid) : { s: params.M * params.N, i: 0, r: 0 };
  const total = params.M * params.N;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-lg">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">Simulación SIR - Autómatas Celulares</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Parámetros</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600">Alto (M): {params.M}</label>
              <input type="range" min="20" max="100" value={params.M} onChange={(e) => setParams({...params, M: parseInt(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Ancho (N): {params.N}</label>
              <input type="range" min="20" max="100" value={params.N} onChange={(e) => setParams({...params, N: parseInt(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Infectados iniciales (I0): {params.I0}</label>
              <input type="range" min="1" max="50" value={params.I0} onChange={(e) => setParams({...params, I0: parseInt(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Tiempo total (T): {params.T}</label>
              <input type="range" min="50" max="500" value={params.T} onChange={(e) => setParams({...params, T: parseInt(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Radio (r): {params.r}</label>
              <input type="range" min="1" max="3" value={params.r} onChange={(e) => setParams({...params, r: parseInt(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Beta (β): {params.beta.toFixed(2)}</label>
              <input type="range" min="0.1" max="1" step="0.1" value={params.beta} onChange={(e) => setParams({...params, beta: parseFloat(e.target.value)})} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Gamma (γ) = Alpha (α): {params.alpha.toFixed(2)}</label>
              <input type="range" min="0.01" max="0.5" step="0.01" value={params.alpha} onChange={(e) => setParams({...params, alpha: parseFloat(e.target.value)})} className="w-full" />
            </div>
            {/* NEW: Nexp control */}
            <div>
              <label className="block text-sm font-medium text-gray-600">Nexp: {Nexp}</label>
              <input type="range" min="5" max="50" value={Nexp} onChange={(e) => setNexp(parseInt(e.target.value))} className="w-full" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Controles</h2>
          <div className="space-y-3">
            <button onClick={() => setIsRunning(!isRunning)} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
              {isRunning ? <Pause size={20} /> : <Play size={20} />}
              {isRunning ? 'Pausar' : 'Iniciar (visible)'}
            </button>
            <button onClick={initializeGrid} className="w-full flex items-center justify-center gap-2 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700">
              <RotateCcw size={20} />
              Reiniciar (semilla fija)
            </button>
            <button onClick={generateGif} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700">
              <Download size={20} />
              Descargar GIF (corrida visible)
            </button>
            {/* NEW: Export JSON like Python */}
            <button onClick={exportNexpJSON} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700">
              Exportar Nexp → JSON
            </button>
          </div>

          <div className="mt-6 space-y-2 text-sm">
            <p className="text-gray-700"><span className="font-semibold">Tiempo:</span> {time}/{params.T}</p>
            <p className="text-blue-600"><span className="font-semibold">Susceptibles:</span> {counts.s} ({(counts.s/total*100).toFixed(1)}%)</p>
            <p className="text-red-600"><span className="font-semibold">Infectados:</span> {counts.i} ({(counts.i/total*100).toFixed(1)}%)</p>
            <p className="text-green-600"><span className="font-semibold">Recuperados:</span> {counts.r} ({(counts.r/total*100).toFixed(1)}%)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Leyenda</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-700">Susceptible (S)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">Infectado (I)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">Recuperado (R)</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-4">La simulación usa bordes periódicos. El JSON exportado incluye todas las corridas y el promedio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Grid de Células</h2>
          <canvas ref={canvasRef} width={400} height={400} className="w-full border-2 border-gray-300 rounded" />
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Dinámica (corrida visible)</h2>
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="s" stroke="#3b82f6" name="Susceptibles" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="i" stroke="#ef4444" name="Infectados" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="r" stroke="#10b981" name="Recuperados" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-300 flex items-center justify-center text-gray-500">Ejecuta la simulación para ver la gráfica</div>
          )}
        </div>
      </div>

      {/* If you keep this script tag, ensure your bundler doesn’t double-load GIF.js */}
      <script src="https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js"></script>
    </div>
  );
};

export default SIRSimulation;
