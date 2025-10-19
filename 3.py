import numpy as np
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter, FFMpegWriter
from matplotlib.patches import Circle
import seaborn as sns
import os
import json

# Configuración de estilo
sns.set_style("whitegrid")
plt.rcParams['figure.figsize'] = (15, 6)

class SIRParticleSimulation:
    """
    Simulación del modelo SIR mediante sistema de partículas.
    
    Estados:
    0 - Susceptible (S)
    1 - Infectado (I)
    2 - Recuperado (R)
    """
    
    def __init__(self, L=10, Ntotal=200, I0=5, vmax=0.5, r=0.3, beta=0.5, gamma=0.1, dt=0.1):
        """
        Parámetros:
        -----------
        L : float
            Tamaño del cuadrado [0, L] x [0, L]
        Ntotal : int
            Población total de partículas
        I0 : int
            Número inicial de infectados
        vmax : float
            Velocidad máxima de las partículas
        r : float
            Radio de contagio
        beta : float
            Tasa de infección
        gamma : float
            Tasa de recuperación
        dt : float
            Delta de tiempo para la simulación
        """
        self.L = L
        self.Ntotal = Ntotal
        self.I0 = I0
        self.vmax = vmax
        self.r = r
        self.beta = beta
        self.gamma = gamma
        self.dt = dt
        
        # Inicializar posiciones aleatorias
        self.positions = np.random.uniform(0, L, (Ntotal, 2))
        
        # Inicializar velocidades aleatorias
        angles = np.random.uniform(0, 2*np.pi, Ntotal)
        speeds = np.random.uniform(0.5*vmax, vmax, Ntotal)
        self.velocities = np.column_stack([speeds * np.cos(angles), 
                                           speeds * np.sin(angles)])
        
        # Inicializar estados (0: S, 1: I, 2: R)
        self.states = np.zeros(Ntotal, dtype=int)
        # Seleccionar infectados iniciales aleatoriamente
        infected_indices = np.random.choice(Ntotal, I0, replace=False)
        self.states[infected_indices] = 1
        
        # Tiempo de infección (para controlar la recuperación)
        self.infection_time = np.zeros(Ntotal)
        self.infection_time[infected_indices] = 0
        
        # Historial para gráficas
        self.time_history = [0]
        self.S_history = [np.sum(self.states == 0)]
        self.I_history = [np.sum(self.states == 1)]
        self.R_history = [np.sum(self.states == 2)]
        
        self.current_time = 0
        
    def update(self):
        """Actualiza la simulación un paso de tiempo."""
        # Actualizar posiciones
        self.positions += self.velocities * self.dt
        
        # Aplicar condiciones de frontera (rebote en paredes)
        for i in range(self.Ntotal):
            for dim in range(2):
                if self.positions[i, dim] < 0:
                    self.positions[i, dim] = 0
                    self.velocities[i, dim] *= -1
                elif self.positions[i, dim] > self.L:
                    self.positions[i, dim] = self.L
                    self.velocities[i, dim] *= -1
        
        # Detectar colisiones y contagios
        susceptible_mask = self.states == 0
        infected_mask = self.states == 1
        
        susceptible_indices = np.where(susceptible_mask)[0]
        infected_indices = np.where(infected_mask)[0]
        
        # Verificar contagios
        for s_idx in susceptible_indices:
            for i_idx in infected_indices:
                distance = np.linalg.norm(self.positions[s_idx] - self.positions[i_idx])
                if distance < self.r:
                    # Probabilidad de contagio
                    if np.random.random() < self.beta * self.dt:
                        self.states[s_idx] = 1
                        self.infection_time[s_idx] = self.current_time
                        break
        
        # Actualizar recuperaciones
        for i_idx in infected_indices:
            time_infected = self.current_time - self.infection_time[i_idx]
            # Probabilidad de recuperación
            if np.random.random() < self.gamma * self.dt:
                self.states[i_idx] = 2
        
        # Actualizar tiempo
        self.current_time += self.dt
        
        # Guardar historial
        self.time_history.append(self.current_time)
        self.S_history.append(np.sum(self.states == 0))
        self.I_history.append(np.sum(self.states == 1))
        self.R_history.append(np.sum(self.states == 2))
    
    def get_colors(self):
        """Retorna colores según el estado de cada partícula."""
        colors = np.empty(self.Ntotal, dtype=object)
        colors[self.states == 0] = 'blue'      # Susceptible
        colors[self.states == 1] = 'red'       # Infectado
        colors[self.states == 2] = 'green'     # Recuperado
        return colors
    
    def run_simulation(self, T_max=100, save_animation=True, filename='sir_simulation.mp4', format='mp4'):
        """
        Ejecuta la simulación completa.
        
        Parámetros:
        -----------
        T_max : float
            Tiempo máximo de simulación
        save_animation : bool
            Si True, guarda la animación
        filename : str
            Nombre del archivo para guardar la animación
        format : str
            Formato de salida: 'mp4' o 'gif'
        """
        num_steps = int(T_max / self.dt)
        
        # Crear figura con dos subplots
        fig = plt.figure(figsize=(16, 6))
        ax1 = plt.subplot(121)
        ax2 = plt.subplot(122)
        
        # Configurar subplot de partículas
        ax1.set_xlim(0, self.L)
        ax1.set_ylim(0, self.L)
        ax1.set_aspect('equal')
        ax1.set_xlabel('x', fontsize=12)
        ax1.set_ylabel('y', fontsize=12)
        ax1.set_title('Simulación de Partículas - Modelo SIR', fontsize=14, fontweight='bold')
        
        # Scatter plot inicial
        scatter = ax1.scatter(self.positions[:, 0], self.positions[:, 1], 
                             c=self.get_colors(), s=50, alpha=0.7, edgecolors='black', linewidth=0.5)
        
        # Configurar subplot de curvas SIR
        ax2.set_xlim(0, T_max)
        ax2.set_ylim(0, self.Ntotal)
        ax2.set_xlabel('Tiempo (t)', fontsize=12)
        ax2.set_ylabel('Número de individuos', fontsize=12)
        ax2.set_title('Evolución del Modelo SIR', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        
        line_S, = ax2.plot([], [], 'b-', linewidth=2, label='Susceptibles (S)')
        line_I, = ax2.plot([], [], 'r-', linewidth=2, label='Infectados (I)')
        line_R, = ax2.plot([], [], 'g-', linewidth=2, label='Recuperados (R)')
        ax2.legend(loc='right', fontsize=10)
        
        # Texto para estadísticas
        stats_text = ax1.text(0.02, 0.98, '', transform=ax1.transAxes, 
                             verticalalignment='top', fontsize=10,
                             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        def init():
            scatter.set_offsets(self.positions)
            scatter.set_color(self.get_colors())
            line_S.set_data([], [])
            line_I.set_data([], [])
            line_R.set_data([], [])
            return scatter, line_S, line_I, line_R, stats_text
        
        def animate(frame):
            # Actualizar simulación
            self.update()
            
            # Actualizar partículas
            scatter.set_offsets(self.positions)
            scatter.set_color(self.get_colors())
            
            # Actualizar curvas SIR
            line_S.set_data(self.time_history, self.S_history)
            line_I.set_data(self.time_history, self.I_history)
            line_R.set_data(self.time_history, self.R_history)
            
            # Actualizar estadísticas
            stats_text.set_text(f'Tiempo: {self.current_time:.1f}\n'
                              f'S: {self.S_history[-1]} ({100*self.S_history[-1]/self.Ntotal:.1f}%)\n'
                              f'I: {self.I_history[-1]} ({100*self.I_history[-1]/self.Ntotal:.1f}%)\n'
                              f'R: {self.R_history[-1]} ({100*self.R_history[-1]/self.Ntotal:.1f}%)')
            
            return scatter, line_S, line_I, line_R, stats_text
        
        # Crear animación
        # Reducir frames para acelerar: actualizar cada 5 pasos
        frames_to_show = num_steps // 5
        
        def animate_fast(frame):
            # Ejecutar 5 pasos de simulación por cada frame
            for _ in range(5):
                self.update()
            
            # Actualizar partículas
            scatter.set_offsets(self.positions)
            scatter.set_color(self.get_colors())
            
            # Actualizar curvas SIR
            line_S.set_data(self.time_history, self.S_history)
            line_I.set_data(self.time_history, self.I_history)
            line_R.set_data(self.time_history, self.R_history)
            
            # Actualizar estadísticas
            stats_text.set_text(f'Tiempo: {self.current_time:.1f}\n'
                              f'S: {self.S_history[-1]} ({100*self.S_history[-1]/self.Ntotal:.1f}%)\n'
                              f'I: {self.I_history[-1]} ({100*self.I_history[-1]/self.Ntotal:.1f}%)\n'
                              f'R: {self.R_history[-1]} ({100*self.R_history[-1]/self.Ntotal:.1f}%)')
            
            return scatter, line_S, line_I, line_R, stats_text
        
        anim = FuncAnimation(fig, animate_fast, init_func=init, 
                           frames=frames_to_show, interval=30, blit=True, repeat=False)
        
        # Guardar animación
        if save_animation:
            print(f"Guardando animación en '{filename}'... (esto puede tomar unos minutos)")
            
            if format.lower() == 'mp4':
                # Usar FFMpegWriter para MP4
                writer = FFMpegWriter(fps=20, metadata=dict(artist='SIR Simulation'), bitrate=1800)
                anim.save(filename, writer=writer)
            else:
                # Usar PillowWriter para GIF
                writer = PillowWriter(fps=20)
                anim.save(filename, writer=writer)
            
            print(f"¡Animación guardada exitosamente en '{filename}'!")
        
        plt.tight_layout()
        plt.show()
        
        return anim
    
    def plot_final_results(self):
        """Genera gráficas finales de los resultados."""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Gráfica de evolución temporal
        ax1.plot(self.time_history, self.S_history, 'b-', linewidth=2, label='Susceptibles (S)')
        ax1.plot(self.time_history, self.I_history, 'r-', linewidth=2, label='Infectados (I)')
        ax1.plot(self.time_history, self.R_history, 'g-', linewidth=2, label='Recuperados (R)')
        ax1.set_xlabel('Tiempo (t)', fontsize=12)
        ax1.set_ylabel('Número de individuos', fontsize=12)
        ax1.set_title('Evolución Temporal del Modelo SIR', fontsize=14, fontweight='bold')
        ax1.legend(fontsize=11)
        ax1.grid(True, alpha=0.3)
        
        # Gráfica de proporciones finales
        final_S = self.S_history[-1]
        final_I = self.I_history[-1]
        final_R = self.R_history[-1]
        
        sizes = [final_S, final_I, final_R]
        labels = [f'Susceptibles\n{final_S} ({100*final_S/self.Ntotal:.1f}%)',
                 f'Infectados\n{final_I} ({100*final_I/self.Ntotal:.1f}%)',
                 f'Recuperados\n{final_R} ({100*final_R/self.Ntotal:.1f}%)']
        colors_pie = ['#3498db', '#e74c3c', '#2ecc71']
        
        ax2.pie(sizes, labels=labels, colors=colors_pie, autopct='', startangle=90,
               textprops={'fontsize': 11})
        ax2.set_title('Distribución Final de la Población', fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        plt.show()

# ==================== EJEMPLO DE USO (JSON Nexp) ====================


params = {
    'L': 10, 'Ntotal': 200, 'I0': 5,
    'vmax': 0.5, 'r': 0.3,
    'beta': 0.8, 'gamma': 0.1,
    'dt': 0.1
}
Nexp = 10
T_max = 100.0
dt = params['dt']
num_steps = int(T_max / dt)
seed_init = 12345

os.makedirs("promedios1/anim", exist_ok=True)

print("Iniciando simulaciones (partículas) con condiciones iniciales fijas...")
print(f"Parámetros: {params}, Nexp={Nexp}, seed_init={seed_init}")

# --- Generar condiciones iniciales una sola vez ---
rng = np.random.default_rng(seed_init)
L, N, I0, vmax = params['L'], params['Ntotal'], params['I0'], params['vmax']

positions0 = rng.uniform(0, L, (N, 2))
angles0 = rng.uniform(0, 2*np.pi, N)
speeds0 = rng.uniform(0.5*vmax, vmax, N)
velocities0 = np.column_stack([speeds0 * np.cos(angles0), speeds0 * np.sin(angles0)])
states0 = np.zeros(N, dtype=int)
infected_idx0 = rng.choice(N, I0, replace=False)
states0[infected_idx0] = 1

def make_sim():
    sim = SIRParticleSimulation(**params)
    sim.positions = positions0.copy()
    sim.velocities = velocities0.copy()
    sim.states = states0.copy()
    sim.infection_time = np.zeros(N)
    sim.infection_time[sim.states == 1] = 0.0
    sim.time_history = [0.0]
    sim.S_history = [np.sum(sim.states == 0)]
    sim.I_history = [np.sum(sim.states == 1)]
    sim.R_history = [np.sum(sim.states == 2)]
    sim.current_time = 0.0
    return sim

runs = []
accS = np.zeros(num_steps + 1)
accI = np.zeros(num_steps + 1)
accR = np.zeros(num_steps + 1)

for k in range(Nexp):
    sim = make_sim()
    # Ejecutar SIN guardar video (rápido)
    steps_to_show = int(T_max / params['dt']) // 5  # no afecta la dinámica, solo la UI interna
    # Ejecutar simulación (T_max = tiempo máximo de simulación)
    anim = sim.run_simulation(T_max=100, save_animation=True, filename="./out/gifs/sir_particle_simulation"+str(k)+".gif", format='gif')


    t_arr = np.array(sim.time_history[:num_steps+1])
    s_arr = np.array(sim.S_history[:num_steps+1], dtype=float)
    i_arr = np.array(sim.I_history[:num_steps+1], dtype=float)
    r_arr = np.array(sim.R_history[:num_steps+1], dtype=float)

    runs.append({
        "run_id": k,
        "t": t_arr.tolist(),
        "s": s_arr.tolist(),
        "i": i_arr.tolist(),
        "r": r_arr.tolist()
    })
    accS += s_arr; accI += i_arr; accR += r_arr

mean = {
    "t": (np.arange(num_steps + 1) * dt).tolist(),
    "s": (accS / Nexp).tolist(),
    "i": (accI / Nexp).tolist(),
    "r": (accR / Nexp).tolist()
}

payload = {
    "meta": {
        "model": "particles",
        "params": params,
        "Nexp": Nexp,
        "T_max": T_max,
        "dt": dt,
        "seed_init": seed_init,
        "note": "Condiciones iniciales fijas para todas las corridas; dinámica estocástica por paso"
    },
    "runs": runs,
    "mean": mean
}

os.makedirs("out", exist_ok=True)
with open("out/sir_particles_results.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print("JSON guardado en out/sir_particles_results.json")
