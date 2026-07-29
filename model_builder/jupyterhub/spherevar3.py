#!/usr/bin/env python
# coding: utf-8

# # Spherevar1
# ***
# ## Setup the Environment
# ***

# In[1]:


import os
import pickle


# In[2]:


import spatialpy


# ***
# ## Geometries
# ***

# In[3]:


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

# In[4]:


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
        1, 0.2, deltar=0.1
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
    tspan = spatialpy.TimeSpan.arange(0.05, t=20, timestep_size=1e-05)
    model.timespan(tspan)
    return model


# ### Instantiate the model

# In[5]:


model = create_spherevar1()


# ***
# ## Simulation Parameters
# ***

# In[6]:


def configure_simulation():
    kwargs = {
        # 'number_of_trajectories': 1,
        # 'seed': None,
    }
    return kwargs


# ***
# ## Run the Simulation
# ***

# In[7]:


kwargs = configure_simulation()
# results = model.run(**kwargs)
path = 'spherevar3.proj/spherevar1.wkgp/spherevar3_SES.wkfl/job_06042026_103405/results/results.p'
with open(os.path.join(os.path.expanduser('~'), path), 'rb') as results_file:
    results = pickle.load(results_file)


# ***
# ## Visualization
# ***

# In[8]:


results.plot_species('A', animated=True, width='auto', height='auto')


# In[ ]:




