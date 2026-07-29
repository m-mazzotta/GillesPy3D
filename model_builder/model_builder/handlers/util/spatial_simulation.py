'''
GillesPy3D is a platform for simulating biochemical systems
Copyright (C) 2025 GillesPy3D developers.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
'''

import os
import pickle
import logging
import traceback

from spatialpy import TimeSpan

from .model_builder_job import GillesPy3DJob
from .model_builder_errors import GillesPy3DJobResultsError

log = logging.getLogger("gillespy3d")

class SpatialSimulation(GillesPy3DJob):
    '''
    ################################################################################################
    GillesPy3D spatial ensemble simulation job object
    ################################################################################################
    '''

    TYPE = "spatial"

    def __init__(self, path, preview=False, target=None):
        '''
        Intitialize a spatial ensemble simulation job object

        Attributes
        ----------
        path : str
            Path to the spatial ensemble simulation job
        preview : bool
            Indicates whether or not the simulation is a preview.
        target : string
            Results data target used for ploting
        '''
        super().__init__(path=path)
        if not preview:
            self.settings = self.load_settings()
            self.s_py_model, self.s_model = self.load_models()
        else:
            self.target = target


    def __get_run_settings(self):
        return self.get_run_settings(settings=self.settings, solver_map=None)

    @classmethod
    def __store_pickled_results(cls, results):
        try:
            with open('results/results.p', 'wb') as results_file:
                pickle.dump(results, results_file)
        except Exception as err:
            message = f"Error storing pickled results: {err}\n{traceback.format_exc()}"
            log.error(message)
            return message
        return False

    def __update_timespan(self):
        if "timespanSettings" in self.settings:
            keys = self.settings['timespanSettings'].keys()
            if "endSim" in keys and "timeStep" in keys and "timestepSize" in keys:
                end = self.settings['timespanSettings']['endSim']
                step_size = self.settings['timespanSettings']['timeStep']
                timestep_size = self.settings['timespanSettings']['timestepSize']
                self.s_py_model.timespan(
                    TimeSpan.arange(step_size, t=end + step_size, timestep_size=timestep_size)
                )

    def __plot_preview_target(self, results, target, kwargs):
        properties = ["type", "rho", "mass", "nu"]
        plot_kwargs = dict(kwargs)
        if target in properties or target.startswith("v["):
            property_name = target
            if target.startswith("v["):
                plot_kwargs['p_ndx'] = int(target[2])
                property_name = "v"
            plot = results.plot_property(
                property_name=property_name,
                **plot_kwargs
            )
        else:
            concentration = self.s_model['defaultMode'] == "discrete-concentration"
            deterministic = self.s_model['defaultMode'] == "continuous"
            plot = results.plot_species(
                species=target, concentration=concentration,
                deterministic=deterministic, **plot_kwargs
            )
        plot["layout"]["autosize"] = True
        plot["config"] = {"responsive": True, "displayModeBar": True}
        return plot

    def run(self, preview=False, verbose=False):
        '''
        Run a SpatialPy ensemble simulation job

        Attributes
        ----------
        preview : bool
            Indicates whether or not to run a ??? sec preivew
        verbose : bool
            Indicates whether or not to print debug statements
        '''
        if preview:
            if verbose:
                self.log("info", "Running a preview spatial ensemble simulation")
            results = self.s_py_model.run()
            t_ndx_list = list(range(len(os.listdir(results.result_dir)) - 1))
            kwargs = {"t_ndx_list": t_ndx_list, "animated": True, "width": "auto", "height": "auto",
                      "return_plotly_figure": True, "f_duration": 100, "t_duration": 100}
            if self.target == "__all_species__":
                species = [entry['name'] for entry in self.s_model['species']]
                figures = {
                    name: self.__plot_preview_target(results, name, kwargs)
                    for name in species
                }
                return {"species": species, "figures": figures}
            return self.__plot_preview_target(results, self.target, kwargs)
        if verbose:
            log.info("Running the spatial ensemble simulation")
        self.__update_timespan()
        kwargs = self.__get_run_settings()
        results = self.s_py_model.run(**kwargs)
        if verbose:
            log.info("The spatial ensemble simulation has completed")
            log.info("Storing the results as pickle")
        if not 'results' in os.listdir():
            os.mkdir('results')
        pkl_err = self.__store_pickled_results(results=results)
        if pkl_err:
            message = "An unexpected error occured with the result object"
            trace = str(pkl_err)
            raise GillesPy3DJobResultsError(message, trace)
        return None
