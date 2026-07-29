#!/usr/bin/env python
# coding: utf-8

# # Spherevar1
# ***
# ## Setup the Environment
# ***

# In[1]:


import time
import json
import spatialpy
import plotly


# ***
# ## Geometries
# ***

# In[2]:


class Shape1(spatialpy.Geometry):
    def __init__(self):
        pass

    def inside(self, point, on_boundary):
        namespace = {'x': point[0], 'y': point[1], 'z': point[2]}
        formula = '(x*x) + (y*y) + (z*z) < 1'
        return eval(formula, {}, namespace)


# ***
# ## Create the Spherevar1 Model
# ***

# In[8]:


def create_spherevar1(parameter_values=None):
    model = spatialpy.Model(name='spherevar1')

    # Define Domain Type IDs as constants of the Model
    model.TYPE1 = 'type1'

    # Domain
    domain = spatialpy.Domain(
        0, (-0.9978589232386035, 0.9978589232386035), (-0.9989930665413146, 0.9989930665413146),
        (-0.9989930665413146, 0.9978589232386035), rho0=1, c0=10, P0=100, gravity=None
    )

    # Domain Geometries
    shape1_geom = Shape1()

    # Domain Lattices
    shape1_latt = spatialpy.SphericalLattice(
        1, 0.5, deltar=0.5
    )

    # Domain Actions
    domain.add_fill_action(
        lattice=shape1_latt, geometry=shape1_geom, enable=True, apply_action=True,
        type_id=model.TYPE1, mass=1, vol=1, rho=1, nu=0, c=10, fixed=False
    )

    model.add_domain(domain, allow_all_types=True)

    model.staticDomain = True

    # Variables
    A = spatialpy.Species(name='A', diffusion_coefficient=0, restrict_to=[model.TYPE1])
    model.add_species([
        A
    ])

    # Parameters
    P = spatialpy.Parameter(name='P', expression='10')
    model.add_parameter([
        P
    ])

    # Reactions
    r1 = spatialpy.Reaction(
        name='r1', rate='P', restrict_to=[model.TYPE1],
        reactants={}, products={'A': 1}
    )
    model.add_reaction([
        r1
    ])

    # Timespan
    tspan = spatialpy.TimeSpan.arange(1, t=20, timestep_size=0.05)
    model.timespan(tspan)
    return model


# ***
# ## Simulation Parameters
# ***

# In[9]:


def configure_simulation():
    kwargs = {
        # 'number_of_trajectories': 1,
        # 'seed': None,
    }
    return kwargs


# ***
# ## Run the Simulation
# ***

# In[11]:


def run_simulation(config=None):
    """
    Run the Spherevar1 simulation and return a JSON-serializable summary.
    """
    cfg = config or {}
    start_time = time.time()
    model = create_spherevar1(parameter_values=cfg.get("parameter_values"))
    kwargs = configure_simulation()
    results = model.run(**kwargs)
    elapsed_seconds = round(time.time() - start_time, 3)
    figure = None

    try:
        trajectory = results[0] if len(results) > 0 else results
        figure = trajectory.plot_species(
            'A',
            width='auto',
            height='auto',
            animated=True,
            return_plotly_figure=True
        )
        figure = json.loads(json.dumps(figure, cls=plotly.utils.PlotlyJSONEncoder))
        figure['config'] = {"responsive": True, "displayModeBar": True}
    except Exception:
        figure = None

    if cfg.get("plot", False):
        results.plot_species('A', animated=True, width='auto', height='auto')

    return {
        "status": "success",
        "message": "Spherevar1 simulation completed.",
        "elapsed_seconds": elapsed_seconds,
        "model_name": model.name,
        "num_trajectories": len(results),
        "density": cfg.get("density", "unknown"),
        "figure": figure
    }


# ***
# ## Visualization
# ***

# In[12]:


if __name__ == "__main__":
    run_simulation({"plot": True})


# In[ ]:




